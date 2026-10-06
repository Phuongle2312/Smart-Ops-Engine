package com.soe.service;

import com.soe.entity.Node;
import com.soe.entity.NodeMetric;
import com.soe.repository.NodeMetricRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class NodeMetricsService {

    private static final String CMD_DISK_USAGE =
            "df -h / | awk 'NR==2 {print $5}' | tr -d '%'";

    private static final String CMD_CPU_USAGE =
            "grep 'cpu ' /proc/stat | awk '{u=$2+$4; t=$2+$3+$4+$5+$6+$7+$8; print int(u/t*100)}'";

    private static final String CMD_MEMORY_USAGE =
            "free | awk '/Mem:/ {printf \"%.0f\", $3/$2*100}'";

    private final SshService sshService;
    private final LocalMetricsService localMetricsService;
    private final NodeMetricRepository nodeMetricRepository;

    /**
     * Thu thập CPU/RAM/Disk của node, lưu vào DB và trả về snapshot.
     * Node local (127.0.0.1 / localhost) dùng JVM API thay SSH.
     */
    public NodeMetricsSnapshot collectAndSave(Node node) {
        int disk, cpu, memory;

        if (isLocalNode(node)) {
            disk   = (int) localMetricsService.getPrimaryDiskUsagePercent();
            cpu    = (int) localMetricsService.getCpuUsagePercent();
            memory = (int) localMetricsService.getRamInfo().usedPercent();
            log.info("[METRICS] Local node '{}': disk={}% cpu={}% mem={}%",
                    node.getName(), disk, cpu, memory);
        } else {
            disk   = sshFetch(node, CMD_DISK_USAGE,   "disk");
            cpu    = sshFetch(node, CMD_CPU_USAGE,    "cpu");
            memory = sshFetch(node, CMD_MEMORY_USAGE, "memory");
            log.info("[METRICS] Remote node '{}': disk={}% cpu={}% mem={}%",
                    node.getName(), disk, cpu, memory);
        }

        NodeMetric record = NodeMetric.builder()
                .node(node)
                .diskUsagePercent(disk)
                .cpuUsagePercent(cpu)
                .memoryUsagePercent(memory)
                .recordedAt(LocalDateTime.now())
                .build();

        nodeMetricRepository.save(record);

        return new NodeMetricsSnapshot(disk, cpu, memory);
    }

    private boolean isLocalNode(Node node) {
        String h = node.getHost();
        return "127.0.0.1".equals(h) || "localhost".equalsIgnoreCase(h);
    }

    private int sshFetch(Node node, String command, String metricName) {
        try {
            String raw = sshService.executeCommand(node, command);
            return Integer.parseInt(raw.replace("%", "").trim());
        } catch (Exception e) {
            log.warn("[METRICS] Cannot fetch {} for node '{}': {}", metricName, node.getName(), e.getMessage());
            return -1;
        }
    }

    public record NodeMetricsSnapshot(int diskPercent, int cpuPercent, int memoryPercent) {}
}
