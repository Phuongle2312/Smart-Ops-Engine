package com.soe.ai;

/** ai-service lỗi, quá hạn, hoặc từ chối ảnh. */
public class AiServiceException extends RuntimeException {
    private final int status;

    public AiServiceException(String message, int status, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    /** Mã HTTP ai-service trả về; 0 nếu không kết nối được. */
    public int getStatus() {
        return status;
    }

    /** 4xx = ảnh/yêu cầu không hợp lệ, thử lại cũng vô ích. */
    public boolean isClientError() {
        return status >= 400 && status < 500;
    }
}
