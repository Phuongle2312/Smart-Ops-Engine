package com.soe.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
 
import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.lang.management.OperatingSystemMXBean;
import java.util.ArrayList;
import java.util.List;
 
/**
 * LocalMetricsService — Đọc thông số kỹ thuật TRỰC TIẾP từ máy đang chạy.
 *
 * <p>Không cần SSH, không cần credential. Dùng Java built-in API để lấy:
 * <ul>
 *   <li>CPU: % sử dụng, số core, tên CPU</li>
 *   <li>RAM: tổng, đã dùng, còn lại (MB)</li>
 *   <li>Disk: từng phân vùng (C:, D: trên Windows / / trên Linux)</li>
 * </ul>
 *
 * <p><b>Cách dùng:</b> Inject service này vào HealthCheckScheduler
 * thay thế hoặc song song với SshService để giám sát máy local.
 *
 * @author Smart Ops Engine
 */
@Slf4j
@Service
public class LocalMetricsService {
 
    // =========================================================================
    // CPU
    // =========================================================================
 
    /**
     * Lấy % CPU đang sử dụng của toàn hệ thống (0.0 → 100.0).
     *
     * <p>Dùng com.sun.management.OperatingSystemMXBean (có sẵn trong JDK).
     * Lần gọi đầu tiên có thể trả về -1.0 nếu JVM chưa lấy được sample —
     * gọi lại sau 1 giây là ổn.
     *
     * @return % CPU (0.0–100.0), hoặc -1.0 nếu chưa đo được
     */
    public double getCpuUsagePercent() {
        try {
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
 
            // Cast sang com.sun.management để lấy getSystemCpuLoad()
            if (osBean instanceof com.sun.management.OperatingSystemMXBean sunBean) {
                double load = sunBean.getCpuLoad();
                if (load < 0) {
                    log.debug("[LOCAL] CPU load not available yet (JVM warming up)");
                    return -1.0;
                }
                double percent = load * 100.0;
                log.debug("[LOCAL] CPU usage: {}%", String.format("%.1f", percent));
                return Math.round(percent * 10.0) / 10.0; // làm tròn 1 chữ số thập phân
            }
 
            // Fallback: dùng getSystemLoadAverage() (Unix-style, không dùng được trên Windows)
            double avgLoad = osBean.getSystemLoadAverage();
            int cores = osBean.getAvailableProcessors();
            return avgLoad > 0 ? Math.min((avgLoad / cores) * 100.0, 100.0) : -1.0;
 
        } catch (Exception e) {
            log.warn("[LOCAL] Cannot read CPU usage: {}", e.getMessage());
            return -1.0;
        }
    }
 
    /**
     * Lấy số nhân CPU vật lý (logical processors).
     */
    public int getCpuCoreCount() {
        return ManagementFactory.getOperatingSystemMXBean().getAvailableProcessors();
    }
 
    /**
     * Lấy tên hệ điều hành và kiến trúc.
     * VD: "Windows 11 (amd64)" hoặc "Linux (aarch64)"
     */
    public String getOsInfo() {
        OperatingSystemMXBean os = ManagementFactory.getOperatingSystemMXBean();
        return os.getName() + " " + os.getVersion() + " (" + os.getArch() + ")";
    }
 
    // =========================================================================
    // RAM
    // =========================================================================
 
    /**
     * Lấy snapshot bộ nhớ RAM hệ thống.
     * Trả về object RamInfo chứa đầy đủ total / used / free (MB).
     */
    public RamInfo getRamInfo() {
        try {
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
 
            if (osBean instanceof com.sun.management.OperatingSystemMXBean sunBean) {
                long totalBytes = sunBean.getTotalMemorySize();
                long freeBytes  = sunBean.getFreeMemorySize();
                long usedBytes  = totalBytes - freeBytes;
 
                RamInfo info = new RamInfo(
                        bytesToMb(totalBytes),
                        bytesToMb(usedBytes),
                        bytesToMb(freeBytes),
                        calcPercent(usedBytes, totalBytes)
                );
                log.debug("[LOCAL] RAM: {}MB used / {}MB total ({}%)",
                        info.usedMb(), info.totalMb(), info.usedPercent());
                return info;
            }
 
            // Fallback: chỉ đọc được heap JVM (không phải RAM hệ thống)
            MemoryMXBean memBean = ManagementFactory.getMemoryMXBean();
            MemoryUsage heap = memBean.getHeapMemoryUsage();
            long total = heap.getMax() > 0 ? heap.getMax() : heap.getCommitted();
            long used  = heap.getUsed();
            return new RamInfo(bytesToMb(total), bytesToMb(used),
                    bytesToMb(total - used), calcPercent(used, total));
 
        } catch (Exception e) {
            log.warn("[LOCAL] Cannot read RAM info: {}", e.getMessage());
            return new RamInfo(0, 0, 0, 0.0);
        }
    }
 
    // =========================================================================
    // DISK
    // =========================================================================
 
    /**
     * Lấy thông tin tất cả phân vùng disk trên máy.
     *
     * <p>Trên Windows sẽ trả về: C:\, D:\, v.v.
     * Trên Linux/Mac sẽ trả về: /, /home, /data, v.v.
     *
     * @return danh sách DiskInfo cho từng phân vùng
     */
    public List<DiskInfo> getAllDiskInfo() {
        List<DiskInfo> result = new ArrayList<>();
 
        File[] roots = File.listRoots();
        if (roots == null) {
            log.warn("[LOCAL] Cannot list disk roots");
            return result;
        }
 
        for (File root : roots) {
            try {
                long totalBytes = root.getTotalSpace();
                long freeBytes  = root.getUsableSpace(); // usable = còn dùng được (bỏ qua reserved)
                long usedBytes  = totalBytes - freeBytes;
 
                if (totalBytes == 0) continue; // bỏ qua ổ ảo/unmounted
 
                DiskInfo info = new DiskInfo(
                        root.getAbsolutePath(),
                        bytesToGb(totalBytes),
                        bytesToGb(usedBytes),
                        bytesToGb(freeBytes),
                        calcPercent(usedBytes, totalBytes)
                );
 
                log.debug("[LOCAL] Disk {}: {}GB used / {}GB total ({}%)",
                        info.path(), info.usedGb(), info.totalGb(), info.usedPercent());
                result.add(info);
 
            } catch (Exception e) {
                log.warn("[LOCAL] Cannot read disk info for {}: {}", root, e.getMessage());
            }
        }
        return result;
    }
 
    /**
     * Lấy thông tin disk của phân vùng cụ thể.
     * VD: getDiskInfo("C:\\") trên Windows, getDiskInfo("/") trên Linux.
     *
     * @param path đường dẫn phân vùng (VD: "C:\\", "/")
     */
    public DiskInfo getDiskInfo(String path) {
        File root = new File(path);
        long totalBytes = root.getTotalSpace();
        long freeBytes  = root.getUsableSpace();
        long usedBytes  = totalBytes - freeBytes;
 
        return new DiskInfo(
                path,
                bytesToGb(totalBytes),
                bytesToGb(usedBytes),
                bytesToGb(freeBytes),
                calcPercent(usedBytes, totalBytes)
        );
    }
 
    /**
     * Tiện ích: lấy % disk của phân vùng gốc (/ trên Linux, C:\ trên Windows).
     * Phù hợp để dùng trực tiếp trong HealthCheckScheduler.
     */
    public double getPrimaryDiskUsagePercent() {
        String primaryPath = System.getProperty("os.name").toLowerCase().contains("win")
                ? "C:\\" : "/";
        return getDiskInfo(primaryPath).usedPercent();
    }
 
    // =========================================================================
    // Summary: lấy tất cả trong 1 lần gọi
    // =========================================================================
 
    /**
     * Lấy snapshot đầy đủ tình trạng máy local.
     * Tiện dùng cho API endpoint hoặc log định kỳ.
     */
    public SystemSnapshot getSystemSnapshot() {
        return new SystemSnapshot(
                getOsInfo(),
                getCpuCoreCount(),
                getCpuUsagePercent(),
                getRamInfo(),
                getAllDiskInfo()
        );
    }
 
    // =========================================================================
    // Helper methods
    // =========================================================================
 
    private long bytesToMb(long bytes) {
        return bytes / (1024 * 1024);
    }
 
    private double bytesToGb(long bytes) {
        return Math.round((bytes / (1024.0 * 1024 * 1024)) * 10.0) / 10.0;
    }
 
    private double calcPercent(long used, long total) {
        if (total == 0) return 0.0;
        return Math.round((used * 100.0 / total) * 10.0) / 10.0;
    }
 
    // =========================================================================
    // Data classes (Java Records — gọn, immutable, tự có equals/toString)
    // =========================================================================
 
    /**
     * Thông tin RAM tại một thời điểm.
     * @param totalMb   tổng RAM (MB)
     * @param usedMb    đã dùng (MB)
     * @param freeMb    còn trống (MB)
     * @param usedPercent % đã dùng (0.0–100.0)
     */
    public record RamInfo(long totalMb, long usedMb, long freeMb, double usedPercent) {}
 
    /**
     * Thông tin một phân vùng disk.
     * @param path        đường dẫn (VD: "C:\", "/")
     * @param totalGb     tổng dung lượng (GB)
     * @param usedGb      đã dùng (GB)
     * @param freeGb      còn trống (GB)
     * @param usedPercent % đã dùng (0.0–100.0)
     */
    public record DiskInfo(String path, double totalGb, double usedGb,
                           double freeGb, double usedPercent) {}
 
    /**
     * Snapshot toàn bộ tình trạng hệ thống tại một thời điểm.
     */
    public record SystemSnapshot(
            String osInfo,
            int cpuCores,
            double cpuUsagePercent,
            RamInfo ram,
            List<DiskInfo> disks
    ) {}
}