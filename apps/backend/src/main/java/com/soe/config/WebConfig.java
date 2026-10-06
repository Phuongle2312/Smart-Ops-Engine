package com.soe.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Cho phép frontend dev server (Vite, mặc định port 5173) gọi API backend trực tiếp
 * (không có proxy dev). Trang "Cấu hình hệ thống" là request cross-origin thật đầu tiên
 * trong project — các trang khác vẫn đang mock qua localStorage.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173", "http://127.0.0.1:5173")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
