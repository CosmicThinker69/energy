import "server-only";

export type PasswordResetMessage = {
  email: string;
  resetUrl: string;
};

export interface MailService {
  sendPasswordReset(message: PasswordResetMessage): Promise<boolean>;
}

class UnconfiguredMailService implements MailService {
  async sendPasswordReset() {
    if (process.env.NODE_ENV === "development") {
      console.info(
        "Password-reset delivery is not configured. The reset request was stored, but no email was sent.",
      );
    }
    return false;
  }
}

export const mailService: MailService = new UnconfiguredMailService();
