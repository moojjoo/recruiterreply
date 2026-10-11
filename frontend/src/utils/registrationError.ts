import axios from "axios";

export function getRegistrationErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return "Registration failed. Please try again.";
  }

  if (!error.response) {
    return "Unable to connect to the registration service. Check your connection and try again.";
  }

  const status = error.response.status;
  const data: unknown = error.response.data;
  if (status === 409) {
    return "A user with this email already exists. Please sign in or reset your password.";
  }
  if (status === 400) {
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      const allowed = [
        "Invalid email address",
        "Password does not meet requirements",
        "Name is required",
        "Email is required",
        "Password is required",
        "Email and password are required.",
      ];
      if (allowed.includes(data.error)) return data.error;
    }
    return "Please check your registration details and try again.";
  }
  if (status === 429) return "Too many attempts. Please wait and try again.";
  if (status >= 500) {
    return "Registration is temporarily unavailable. Please try again later.";
  }
  return "Registration failed. Please try again.";
}
