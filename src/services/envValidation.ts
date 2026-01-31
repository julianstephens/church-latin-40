/**
 * Environment variable validation service
 * Ensures all required environment variables are present and properly formatted
 */

interface EnvironmentConfig {
  auth0Domain: string;
  auth0ClientId: string;
  pocketbaseUrl: string;
  githubIssuesUrl?: string;
  nodeEnv: string;
}

interface ValidationError {
  variable: string;
  message: string;
  value?: string;
}

class EnvironmentValidator {
  private errors: ValidationError[] = [];

  validate(): EnvironmentConfig {
    this.errors = [];

    // Validate Auth0 configuration
    const auth0Domain = this.validateAuth0Domain();
    const auth0ClientId = this.validateAuth0ClientId();

    // Validate PocketBase configuration
    const pocketbaseUrl = this.validatePocketbaseUrl();

    // Validate optional GitHub issues URL
    const githubIssuesUrl = import.meta.env.VITE_GITHUB_ISSUES_URL;

    // Get node environment
    const nodeEnv = import.meta.env.MODE || "development";

    // If there are errors, throw them all
    if (this.errors.length > 0) {
      this.throwValidationErrors();
    }

    return {
      auth0Domain,
      auth0ClientId,
      pocketbaseUrl,
      githubIssuesUrl,
      nodeEnv,
    };
  }

  private validateAuth0Domain(): string {
    const domain = import.meta.env.VITE_AUTH0_DOMAIN;

    if (!domain || domain.trim() === "") {
      this.addError(
        "VITE_AUTH0_DOMAIN",
        "Auth0 domain is required but not set",
      );
      return "";
    }

    // Validate domain format
    const validPatterns = [
      /\.auth0\.com$/,
      /\.us\.auth0\.com$/,
      /\.eu\.auth0\.com$/,
      /\.au\.auth0\.com$/,
      /\.jp\.auth0\.com$/,
      /\.in\.auth0\.com$/,
      /\.ie\.auth0\.com$/,
      /localhost:\d+$/, // For local development
    ];

    const isValidFormat = validPatterns.some((pattern) => pattern.test(domain));

    if (!isValidFormat) {
      this.addError(
        "VITE_AUTH0_DOMAIN",
        `Auth0 domain format is invalid. Expected format: your-domain.auth0.com or your-domain.region.auth0.com`,
        domain,
      );
    }

    return domain;
  }

  private validateAuth0ClientId(): string {
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

    if (!clientId || clientId.trim() === "") {
      this.addError(
        "VITE_AUTH0_CLIENT_ID",
        "Auth0 client ID is required but not set",
      );
      return "";
    }

    // Auth0 client IDs are typically alphanumeric strings of reasonable length
    if (clientId.length < 10) {
      this.addError(
        "VITE_AUTH0_CLIENT_ID",
        `Auth0 client ID appears to be invalid (too short). Expected at least 10 characters.`,
        clientId,
      );
    }

    return clientId;
  }

  private validatePocketbaseUrl(): string {
    const url = import.meta.env.VITE_POCKETBASE_URL;

    if (!url || url.trim() === "") {
      this.addError(
        "VITE_POCKETBASE_URL",
        "PocketBase URL is required but not set",
      );
      return "";
    }

    // Validate URL format
    try {
      const urlObj = new URL(url);
      // Check for http or https
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        this.addError(
          "VITE_POCKETBASE_URL",
          `PocketBase URL must use http:// or https:// protocol`,
          url,
        );
      }
    } catch {
      this.addError(
        "VITE_POCKETBASE_URL",
        `PocketBase URL is not a valid URL format. Example: http://localhost:8090 or https://pb.example.com`,
        url,
      );
    }

    return url;
  }

  private addError(variable: string, message: string, value?: string): void {
    this.errors.push({ variable, message, value });
  }

  private throwValidationErrors(): void {
    const errorMessage = this.formatErrors();
    console.error(errorMessage);
    throw new Error(
      "Environment validation failed. Check console for details.",
    );
  }

  private formatErrors(): string {
    const lines = [
      "❌ Environment Configuration Errors:",
      "=====================================",
    ];

    this.errors.forEach((error, index) => {
      lines.push(`\n${index + 1}. ${error.variable}`);
      lines.push(`   Error: ${error.message}`);
      if (error.value) {
        lines.push(`   Current value: "${error.value}"`);
      }
    });

    lines.push("\n\n📝 Required environment variables:");
    lines.push("   - VITE_AUTH0_DOMAIN (e.g., your-domain.auth0.com)");
    lines.push("   - VITE_AUTH0_CLIENT_ID");
    lines.push("   - VITE_POCKETBASE_URL (e.g., http://localhost:8090)");
    lines.push("\n💡 Optional environment variables:");
    lines.push("   - VITE_GITHUB_ISSUES_URL");

    lines.push(
      "\n📄 Create a .env.local file in your project root with these variables.",
    );

    return lines.join("\n");
  }
}

// Create singleton instance
let validatedConfig: EnvironmentConfig | null = null;

/**
 * Get and validate environment configuration
 * This should be called early in the application lifecycle
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  if (!validatedConfig) {
    const validator = new EnvironmentValidator();
    validatedConfig = validator.validate();
  }
  return validatedConfig;
}

/**
 * Validate environment without throwing (for testing or conditional initialization)
 */
export function validateEnvironmentQuietly(): {
  isValid: boolean;
  errors: ValidationError[];
} {
  const validator = new EnvironmentValidator();
  const errors: ValidationError[] = [];

  try {
    validator.validate();
    return { isValid: true, errors };
  } catch {
    // Return validation result - errors will be captured by the validator
    return {
      isValid: false,
      errors: validator.getErrors(),
    };
  }
}
