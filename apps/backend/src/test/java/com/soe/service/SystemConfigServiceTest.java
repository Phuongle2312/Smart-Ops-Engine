package com.soe.service;

import com.soe.entity.SystemConfig;
import com.soe.repository.SystemConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class SystemConfigServiceTest {

    @Mock SystemConfigRepository repository;

    private static SystemConfig valid() {
        SystemConfig c = new SystemConfig();
        c.setSmtpHost("smtp");
        c.setSmtpPort(25);
        c.setAlertRecipientEmail("ops@example.test");
        c.setDiskWarningThreshold(80);
        c.setDiskCriticalThreshold(90);
        c.setCpuCriticalThreshold(85);
        c.setMemoryCriticalThreshold(90);
        c.setSchedulerIntervalMs(300_000);
        return c;
    }

    private void assertRejected(SystemConfig c) {
        SystemConfigService service = new SystemConfigService(repository);
        assertThrows(IllegalArgumentException.class, () -> service.updateConfig(c));
        verifyNoInteractions(repository);
    }

    @Test
    void warningMustBeBelowCritical() {
        SystemConfig c = valid();
        c.setDiskWarningThreshold(95);
        c.setDiskCriticalThreshold(50);
        assertRejected(c);
    }

    @Test
    void warningEqualToCriticalIsRejected() {
        SystemConfig c = valid();
        c.setDiskWarningThreshold(90);
        assertRejected(c);
    }

    @Test
    void invalidPortEmailAndRangeAreRejected() {
        SystemConfig c = valid();
        c.setSmtpPort(0);
        assertRejected(c);
        c = valid();
        c.setAlertRecipientEmail("khong-phai-email");
        assertRejected(c);
        c = valid();
        c.setCpuCriticalThreshold(101);
        assertRejected(c);
        c = valid();
        c.setSchedulerIntervalMs(500);
        assertRejected(c);
    }
}
