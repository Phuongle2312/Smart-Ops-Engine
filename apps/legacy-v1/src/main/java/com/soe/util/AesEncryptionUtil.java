package com.soe.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

@Component
public class AesEncryptionUtil {
    private static final String ALGORITHM = "AES";
    private static byte[] KEY;

    @Value("${smartops.aes.secret-key}")
    public void setKey(String key) {
        if (key != null && !key.isEmpty()) {
            KEY = key.getBytes();
        }
    }

    public static String encrypt(String value) {
        if (value == null) return null;
        try {
            SecretKeySpec secretKey = new SecretKeySpec(KEY, ALGORITHM);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            return Base64.getEncoder().encodeToString(cipher.doFinal(value.getBytes()));
        } catch (Exception e) {
            throw new RuntimeException("Error encrypting data", e);
        }
    }

    public static String decrypt(String value) {
        if (value == null) return null;
        try {
            SecretKeySpec secretKey = new SecretKeySpec(KEY, ALGORITHM);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey);
            return new String(cipher.doFinal(Base64.getDecoder().decode(value)));
        } catch (Exception e) {
            throw new RuntimeException("Error decrypting data", e);
        }
    }
}
