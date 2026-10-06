package com.soe.service;

import com.soe.entity.SystemConfig;
import com.soe.service.NodeMetricsService.NodeMetricsSnapshot;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Properties;

/**
 * Gửi email cảnh báo. Cấu hình SMTP KHÔNG cố định lúc Spring khởi động —
 * mỗi lần gửi, {@link JavaMailSender} được dựng lại từ {@link SystemConfigService}
 * để đổi SMTP relay trên UI có hiệu lực ngay, không cần restart backend.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutlookAlertService {

    private final SystemConfigService systemConfigService;

    private JavaMailSender buildMailSender(SystemConfig config) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(config.getSmtpHost());
        sender.setPort(config.getSmtpPort());
        if (config.getSmtpUsername() != null && !config.getSmtpUsername().isBlank()) {
            sender.setUsername(config.getSmtpUsername());
            sender.setPassword(config.getSmtpPassword());
        }

        Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", config.isSmtpAuth());
        props.put("mail.smtp.starttls.enable", config.isSmtpStartTls());
        props.put("mail.smtp.starttls.required", config.isSmtpStartTls());
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");
        return sender;
    }

    public void sendIncidentReport(String nodeName, String issue, String resolution) throws MessagingException, MailException {
        SystemConfig config = systemConfigService.getCurrentConfig();
        JavaMailSender mailSender = buildMailSender(config);
        String recipientEmail = config.getAlertRecipientEmail();

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        String timeStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        helper.setFrom(recipientEmail);
        helper.setTo(recipientEmail);
        helper.setSubject("[Smart Ops Engine] Incident Alert: " + nodeName);
        helper.setText(buildHtmlContent(nodeName, issue, resolution, timeStr), true);

        mailSender.send(message);
        log.info("Email sent successfully for node: {}", nodeName);
    }

    private String buildHtmlContent(String nodeName, String issue, String resolution, String timeStr) {
        return "<html>" +
                "<head>" +
                "<style>" +
                "  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }" +
                "  .container { width: 100%; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }" +
                "  .header { background-color: #d32f2f; color: #ffffff; padding: 15px 20px; text-align: center; border-bottom: 3px solid #b71c1c; }" +
                "  .header h2 { margin: 0; font-size: 20px; font-weight: 600; }" +
                "  .content { padding: 25px 20px; background-color: #fafafa; }" +
                "  .field { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eeeeee; }" +
                "  .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }" +
                "  .label { font-weight: 600; color: #555555; display: block; margin-bottom: 5px; font-size: 14px; }" +
                "  .value { font-size: 16px; color: #212121; }" +
                "  .value.error { color: #d32f2f; font-weight: bold; }" +
                "  .footer { margin-top: 20px; padding: 15px; font-size: 12px; color: #9e9e9e; text-align: center; border-top: 1px solid #e0e0e0; background-color: #ffffff; }" +
                "</style>" +
                "</head>" +
                "<body>" +
                "  <div class='container'>" +
                "    <div class='header'>" +
                "      <h2>🚨 Incident Alert Report</h2>" +
                "    </div>" +
                "    <div class='content'>" +
                "      <div class='field'>" +
                "        <span class='label'>Server Name</span>" +
                "        <span class='value'>" + nodeName + "</span>" +
                "      </div>" +
                "      <div class='field'>" +
                "        <span class='label'>Error Type</span>" +
                "        <span class='value error'>" + issue + "</span>" +
                "      </div>" +
                "      <div class='field'>" +
                "        <span class='label'>Action Taken</span>" +
                "        <span class='value'>" + resolution + "</span>" +
                "      </div>" +
                "      <div class='field'>" +
                "        <span class='label'>Time</span>" +
                "        <span class='value'>" + timeStr + "</span>" +
                "      </div>" +
                "    </div>" +
                "    <div class='footer'>" +
                "      This is an automated message generated by Smart Ops Engine.<br>Please do not reply to this email." +
                "    </div>" +
                "  </div>" +
                "</body>" +
                "</html>";
    }

    public void sendMetricsAlert(String nodeName, NodeMetricsSnapshot metrics,
                                  String alertType, String issue, String resolution) {
        try {
            SystemConfig config = systemConfigService.getCurrentConfig();
            JavaMailSender mailSender = buildMailSender(config);
            String recipientEmail = config.getAlertRecipientEmail();

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            String timeStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

            String severityColor = alertType.endsWith("CRITICAL") ? "#d32f2f" : "#f57c00";
            String metricsRows = metrics == null ? "<tr><td colspan='2'>Không thu thập được metrics</td></tr>"
                    : buildMetricRows(metrics);

            String html = "<html><head><style>"
                    + "body{font-family:'Segoe UI',sans-serif;color:#333}"
                    + ".box{max-width:600px;margin:20px auto;border:1px solid #ddd;border-radius:8px;overflow:hidden}"
                    + ".hdr{background:" + severityColor + ";color:#fff;padding:14px 20px;text-align:center}"
                    + ".hdr h2{margin:0;font-size:18px}"
                    + ".body{padding:20px;background:#fafafa}"
                    + "table{width:100%;border-collapse:collapse;margin-top:10px}"
                    + "td{padding:10px 14px;border-bottom:1px solid #eee;font-size:15px}"
                    + "td:first-child{font-weight:600;color:#555;width:40%}"
                    + ".foot{font-size:12px;color:#999;text-align:center;padding:12px;background:#fff}"
                    + "</style></head><body>"
                    + "<div class='box'>"
                    + "<div class='hdr'><h2>🚨 " + alertType.replace("_", " ") + " — " + nodeName + "</h2></div>"
                    + "<div class='body'><table>"
                    + "<tr><td>Server</td><td>" + nodeName + "</td></tr>"
                    + "<tr><td>Alert Type</td><td style='color:" + severityColor + ";font-weight:bold'>" + alertType + "</td></tr>"
                    + "<tr><td>Mô tả</td><td>" + issue + "</td></tr>"
                    + "<tr><td>Khuyến nghị</td><td>" + resolution + "</td></tr>"
                    + "<tr><td>Thời gian</td><td>" + timeStr + "</td></tr>"
                    + "</table>"
                    + "<h4 style='margin-top:18px;color:#555'>Thông số hệ thống hiện tại</h4>"
                    + "<table>" + metricsRows + "</table>"
                    + "</div>"
                    + "<div class='foot'>Smart Ops Engine — automated alert. Do not reply.</div>"
                    + "</div></body></html>";

            helper.setFrom(recipientEmail);
            helper.setTo(recipientEmail);
            helper.setSubject("[Smart Ops Engine] " + alertType + ": " + nodeName);
            helper.setText(html, true);
            mailSender.send(message);
            log.info("[EMAIL] Metrics alert sent: {} on node '{}'", alertType, nodeName);
        } catch (Exception e) {
            log.error("[EMAIL] Failed to send metrics alert for node '{}': {}", nodeName, e.getMessage());
        }
    }

    /**
     * Gửi email chẩn đoán lỗi từ ảnh (HTML đã dựng sẵn) tới danh sách người nhận, kèm ảnh gốc inline (cid:error-image).
     * Ném exception để caller quyết định xử lý — chẩn đoán đã lưu incident nên không được mất vì lỗi SMTP.
     */
    public void sendDiagnosisReport(java.util.List<String> recipients, String subject, String html,
                                    byte[] image, String imageContentType, String imageName)
            throws MessagingException, MailException {
        SystemConfig config = systemConfigService.getCurrentConfig();
        JavaMailSender mailSender = buildMailSender(config);

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(config.getAlertRecipientEmail());
        helper.setTo(recipients.toArray(new String[0]));
        helper.setSubject(subject);
        helper.setText(html, true);
        if (image != null && image.length > 0) {
            // addInline phải gọi sau setText
            helper.addInline("error-image", new org.springframework.core.io.ByteArrayResource(image),
                    imageContentType == null || imageContentType.isBlank() ? "image/png" : imageContentType);
        }
        mailSender.send(message);
        log.info("[EMAIL] Diagnosis report sent to {} recipient(s): {}", recipients.size(), subject);
    }

    private String buildMetricRows(NodeMetricsSnapshot m) {
        return gauge("CPU", m.cpuPercent())
                + gauge("Memory", m.memoryPercent())
                + gauge("Disk (/)", m.diskPercent());
    }

    private String gauge(String label, int percent) {
        if (percent < 0) return "<tr><td>" + label + "</td><td>N/A</td></tr>";
        String color = percent >= 90 ? "#d32f2f" : percent >= 80 ? "#f57c00" : "#2e7d32";
        return "<tr><td>" + label + "</td><td style='color:" + color + ";font-weight:bold'>"
                + percent + "%</td></tr>";
    }

    /**
     * Gửi email thử bằng cấu hình truyền vào trực tiếp (CHƯA lưu DB) —
     * cho phép IT test SMTP mới trên UI trước khi bấm "Lưu cấu hình".
     */
    public void sendTestEmail(SystemConfig candidateConfig) throws MessagingException, MailException {
        JavaMailSender mailSender = buildMailSender(candidateConfig);
        String recipientEmail = candidateConfig.getAlertRecipientEmail();

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        String timeStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        helper.setFrom(recipientEmail);
        helper.setTo(recipientEmail);
        helper.setSubject("[Smart Ops Engine] Email thử nghiệm cấu hình SMTP");
        helper.setText(buildHtmlContent(
                "TEST-CONFIG",
                "Đây là email kiểm tra cấu hình SMTP mới trên trang Cấu hình hệ thống.",
                "Nếu bạn nhận được email này, cấu hình SMTP đã hoạt động đúng.",
                timeStr), true);

        mailSender.send(message);
        log.info("[EMAIL] Test email sent to {} using host {}:{}",
                recipientEmail, candidateConfig.getSmtpHost(), candidateConfig.getSmtpPort());
    }

    public void sendDailySummaryReport(int activeNodesCount, long openIncidentsCount) throws MessagingException, MailException {
        SystemConfig config = systemConfigService.getCurrentConfig();
        JavaMailSender mailSender = buildMailSender(config);
        String recipientEmail = config.getAlertRecipientEmail();

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        String timeStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        String htmlContent = "<html>" +
                    "<head>" +
                    "<style>" +
                    "  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }" +
                    "  .container { width: 100%; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }" +
                    "  .header { background-color: #1976d2; color: #ffffff; padding: 15px 20px; text-align: center; border-bottom: 3px solid #1565c0; }" +
                    "  .header h2 { margin: 0; font-size: 20px; font-weight: 600; }" +
                    "  .content { padding: 25px 20px; background-color: #fafafa; }" +
                    "  .field { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eeeeee; }" +
                    "  .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }" +
                    "  .label { font-weight: 600; color: #555555; display: block; margin-bottom: 5px; font-size: 14px; }" +
                    "  .value { font-size: 16px; color: #212121; }" +
                    "  .footer { margin-top: 20px; padding: 15px; font-size: 12px; color: #9e9e9e; text-align: center; border-top: 1px solid #e0e0e0; background-color: #ffffff; }" +
                    "</style>" +
                    "</head>" +
                    "<body>" +
                    "  <div class='container'>" +
                    "    <div class='header'>" +
                    "      <h2>📊 Daily Health Report Summary</h2>" +
                    "    </div>" +
                    "    <div class='content'>" +
                    "      <div class='field'>" +
                    "        <span class='label'>Thời gian báo cáo</span>" +
                    "        <span class='value'>" + timeStr + "</span>" +
                    "      </div>" +
                    "      <div class='field'>" +
                    "        <span class='label'>Số lượng Node đang hoạt động</span>" +
                    "        <span class='value'>" + activeNodesCount + "</span>" +
                    "      </div>" +
                    "      <div class='field'>" +
                    "        <span class='label'>Sự cố chưa giải quyết (OPEN)</span>" +
                    "        <span class='value' style='color: " + (openIncidentsCount > 0 ? "#d32f2f" : "#2e7d32") + "; font-weight: bold;'>" + openIncidentsCount + "</span>" +
                    "      </div>" +
                    "      <div class='field'>" +
                    "        <span class='label'>Trạng thái hệ thống</span>" +
                    "        <span class='value'>" + (openIncidentsCount > 0 ? "Cần chú ý - Có sự cố chưa xử lý." : "Hoạt động bình thường.") + "</span>" +
                    "      </div>" +
                    "    </div>" +
                    "    <div class='footer'>" +
                    "      This is an automated message generated by Smart Ops Engine.<br>Please do not reply to this email." +
                    "    </div>" +
                    "  </div>" +
                    "</body>" +
                    "</html>";

            helper.setFrom(recipientEmail);
            helper.setTo(recipientEmail);
            helper.setSubject("[Smart Ops Engine] Daily Health Report Summary");
            helper.setText(htmlContent, true);

        mailSender.send(message);
        log.info("Daily summary report email sent successfully.");
    }
}
