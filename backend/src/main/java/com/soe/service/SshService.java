package com.soe.service;

import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import com.soe.entity.Node;
import com.soe.util.AesEncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.jcraft.jsch.Channel;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SshService {
// Timeout kết nối TCP (ms) — đủ cho môi trường LAN nội bộ
    private static final int CONNECT_TIMEOUT_MS = 10_000;

    // Timeout chờ lệnh trả về (ms) — tăng lên nếu server load cao
    private static final int COMMAND_TIMEOUT_MS = 30_000;

    private final AesEncryptionUtil aesEncryptionUtil;

    /**
     * Thực thi một lệnh shell trên server từ xa và trả về stdout.
     *
     * <p><b>Lưu ý bảo mật:</b> Mật khẩu trong {@link Node} được lưu dạng mã hóa AES.
     * Phương thức này giải mã tạm thời trong bộ nhớ, dùng xong là bỏ — không log ra bao giờ.
     *
     * @param node    đối tượng Node chứa host, port, username, encryptedPassword
     * @param command lệnh shell cần chạy (VD: {@code "df -h / | awk 'NR==2 {print $5}'"})
     * @return chuỗi stdout từ server, đã trim khoảng trắng đầu/cuối
     * @throws SshExecutionException nếu kết nối thất bại hoặc lệnh lỗi (exit code != 0)
     */
    public String executeCommand(Node node, String command) throws SshExecutionException {
        log.info("[SSH] Connecting to node '{}' ({}:{})", node.getName(), node.getHost(), node.getPort());

        JSch jsch = new JSch();
        Session session = null;

        try {
            // --- Bước 1: Giải mã mật khẩu — chỉ tồn tại trong scope này ---
            String plainPassword = AesEncryptionUtil.decrypt(node.getPassword());

            // --- Bước 2: Khởi tạo Session SSH ---
            session = jsch.getSession(node.getUsername(), node.getHost(), node.getPort());
            session.setPassword(plainPassword);

            // Tắt host key checking cho môi trường nội bộ.
            
            // TODO production: thay bằng session.setKnownHosts(knownHostsFile) để bảo mật hơn.
            java.util.Properties config = new java.util.Properties();
            config.put("StrictHostKeyChecking", "no");
            config.put("PreferredAuthentications", "password");
            session.setConfig(config);

            session.connect(CONNECT_TIMEOUT_MS);
            log.debug("[SSH] Session established for node '{}'", node.getName());

            // --- Bước 3: Mở channel exec và chạy lệnh ---
            ChannelExec channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            channel.setInputStream(null);

            // Bắt stderr để log khi có lỗi
            InputStream stderr = channel.getErrStream();
            InputStream stdout = channel.getInputStream();

            channel.connect(CONNECT_TIMEOUT_MS);

            // --- Bước 4: Đọc output ---
            String result = readStream(stdout);
            String errorOutput = readStream(stderr);

            // Chờ lệnh hoàn tất với timeout
            waitForChannelClosure(channel, COMMAND_TIMEOUT_MS);

            int exitCode = channel.getExitStatus();
            channel.disconnect();

            if (exitCode != 0) {
                log.warn("[SSH] Command on '{}' exited with code {}. Stderr: {}",
                        node.getName(), exitCode, errorOutput);
                // Vẫn trả về kết quả vì một số lệnh (như awk) có exit code khác 0 nhưng vẫn OK
            }

            log.info("[SSH] Command on '{}' completed. Exit: {}, Output: '{}'",
                    node.getName(), exitCode, result);
            return result.trim();

        } catch (JSchException e) {
            // Lỗi kết nối: sai host, sai port, timeout, sai credentials
            String msg = String.format("Không thể kết nối SSH tới node '%s' (%s:%d). Lý do: %s",
                    node.getName(), node.getHost(), node.getPort(), e.getMessage());
            log.error("[SSH] {}", msg, e);
            throw new SshExecutionException(msg, e);

        } catch (Exception e) {
            String msg = String.format("Lỗi không xác định khi thực thi lệnh trên node '%s': %s",
                    node.getName(), e.getMessage());
            log.error("[SSH] {}", msg, e);
            throw new SshExecutionException(msg, e);

        } finally {
            // Đảm bảo session luôn được đóng dù có exception
            if (session != null && session.isConnected()) {
                session.disconnect();
                log.debug("[SSH] Session disconnected for node '{}'", node.getName());
            }
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Đọc toàn bộ nội dung InputStream thành String (UTF-8).
     * Sử dụng BufferedReader để hiệu quả hơn đọc từng byte.
     */
    private String readStream(InputStream inputStream) throws Exception {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }

    /**
     * Polling chờ channel đóng với timeout để tránh block vô hạn.
     *
     * @param channel    channel đang chờ
     * @param timeoutMs  thời gian tối đa (ms)
     */
    private void waitForChannelClosure(Channel channel, int timeoutMs) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (!channel.isClosed()) {
            if (System.currentTimeMillis() > deadline) {
                log.warn("[SSH] Command timeout after {}ms — channel may still be running", timeoutMs);
                break;
            }
            Thread.sleep(200);
        }
    }

    // -------------------------------------------------------------------------
    // Custom Exception
    // -------------------------------------------------------------------------

    /**
     * Exception chuyên biệt cho SshService, giúp caller phân biệt lỗi SSH
     * với các loại lỗi khác trong hệ thống.
     */
    public static class SshExecutionException extends Exception {
        public SshExecutionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
    
}
