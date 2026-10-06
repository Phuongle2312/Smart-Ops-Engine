package com.soe.ai;

import org.springframework.web.util.HtmlUtils;

import java.util.List;

/**
 * Dựng nội dung email chẩn đoán. Mọi văn bản đến từ AI / OCR / người dùng đều bị escape HTML —
 * ảnh lỗi có thể chứa chuỗi tùy ý nên coi là dữ liệu không tin cậy.
 */
public final class DiagnosisEmailTemplate {

    private DiagnosisEmailTemplate() {}

    public static String subject(String nodeName, DiagnosisResult r) {
        String prefix = r.isUnknown() ? "Cần gắn nhãn thủ công" : r.needsReview() ? "Cần xác nhận" : "Chẩn đoán lỗi";
        return "[Smart Ops Engine] " + prefix + ": " + (r.isUnknown() ? "chưa nhận diện được" : r.errorCode())
                + " — " + nodeName;
    }

    public static String subjectFailure(String nodeName) {
        return "[Smart Ops Engine] Không phân tích được ảnh lỗi — " + nodeName;
    }

    public static String build(String nodeName, DiagnosisResult r, String timeStr, boolean hasImage) {
        String color = switch (String.valueOf(r.severity())) {
            case "critical" -> "#d32f2f";
            case "high" -> "#f57c00";
            default -> "#1976d2";
        };
        StringBuilder sb = new StringBuilder();
        sb.append("<html><head><style>")
                .append("body{font-family:'Segoe UI',sans-serif;color:#333}")
                .append(".box{max-width:680px;margin:20px auto;border:1px solid #ddd;border-radius:8px;overflow:hidden}")
                .append(".hdr{background:").append(color).append(";color:#fff;padding:14px 20px}")
                .append(".hdr h2{margin:0;font-size:18px}")
                .append(".body{padding:20px;background:#fafafa}")
                .append("table{width:100%;border-collapse:collapse}")
                .append("td{padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;vertical-align:top}")
                .append("td:first-child{font-weight:600;color:#555;width:30%}")
                .append("pre{white-space:pre-wrap;background:#fff;border:1px solid #eee;padding:10px;font-size:13px}")
                .append(".warn{background:#fff8e1;border-left:4px solid #f57c00;padding:8px 12px;margin:12px 0}")
                .append(".foot{font-size:12px;color:#999;text-align:center;padding:12px;background:#fff}")
                .append("</style></head><body><div class='box'>");

        sb.append("<div class='hdr'><h2>").append(r.isUnknown()
                ? "Chưa nhận diện được lỗi từ ảnh"
                : "Chẩn đoán từ ảnh: " + esc(r.errorCode())).append(" — ").append(esc(nodeName)).append("</h2></div>");
        sb.append("<div class='body'>");

        if (r.needsReview()) {
            sb.append("<div class='warn'><b>Cần xác nhận:</b> độ tin cậy chưa đủ cao, vui lòng đối chiếu với ảnh gốc "
                    + "trước khi xử lý.</div>");
        } else if (r.isUnknown()) {
            sb.append("<div class='warn'><b>Cần gắn nhãn thủ công:</b> AI không đủ cơ sở để kết luận. "
                    + "Quản trị viên vui lòng xem ảnh và xử lý.</div>");
        }

        sb.append("<table>")
                .append(row("Máy chủ", esc(nodeName)))
                .append(row("Loại lỗi", esc(r.errorCode()) + " (" + esc(r.resource()) + ", " + esc(r.severity()) + ")"))
                .append(row("Độ tin cậy", Math.round(r.confidence() * 100) + "% — nguồn: " + esc(r.source())))
                .append(row("Thời gian", esc(timeStr)));
        if (r.evidence() != null && !r.evidence().isEmpty()) {
            sb.append(row("Bằng chứng", "<ul style='margin:0;padding-left:18px'>" + listItems(r.evidence()) + "</ul>"));
        }
        sb.append("</table>");

        if (hasImage) {
            sb.append("<h4 style='color:#555'>Ảnh gốc</h4><img src='cid:error-image' style='max-width:100%;border:1px solid #ddd'>");
        }
        if (r.runbook() != null) {
            sb.append("<h4 style='color:#555'>Hướng xử lý: ").append(esc(r.runbook().title())).append("</h4>")
                    .append("<p style='font-size:13px;color:#777'>Gợi ý để người phụ trách tự thực hiện tại máy — "
                            + "hệ thống không tự chạy lệnh.</p>")
                    .append("<pre>").append(esc(r.runbook().content())).append("</pre>");
        }
        if (r.warnings() != null && !r.warnings().isEmpty()) {
            sb.append("<h4 style='color:#555'>Lưu ý hệ thống</h4><ul>").append(listItems(r.warnings())).append("</ul>");
        }
        sb.append("</div><div class='foot'>Smart Ops Engine — email tự động, vui lòng không trả lời. "
                + "Mã chẩn đoán: ").append(esc(r.diagnosisId())).append("</div></div></body></html>");
        return sb.toString();
    }

    public static String buildFailure(String nodeName, String reason, String timeStr, boolean hasImage) {
        return "<html><body style=\"font-family:'Segoe UI',sans-serif;color:#333\">"
                + "<h3>Không phân tích được ảnh lỗi — " + esc(nodeName) + "</h3>"
                + "<p>Dịch vụ AI không phản hồi hoặc lỗi. Vui lòng xem ảnh đính kèm và xử lý thủ công.</p>"
                + "<p><b>Thời gian:</b> " + esc(timeStr) + "<br><b>Chi tiết:</b> " + esc(reason) + "</p>"
                + (hasImage ? "<img src='cid:error-image' style='max-width:100%;border:1px solid #ddd'>" : "")
                + "</body></html>";
    }

    private static String row(String label, String htmlValue) {
        return "<tr><td>" + label + "</td><td>" + htmlValue + "</td></tr>";
    }

    private static String listItems(List<String> items) {
        StringBuilder sb = new StringBuilder();
        for (String i : items) sb.append("<li>").append(esc(i)).append("</li>");
        return sb.toString();
    }

    private static String esc(String s) {
        return s == null ? "" : HtmlUtils.htmlEscape(s);
    }
}
