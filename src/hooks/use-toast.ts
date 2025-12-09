// Simple toast hook using sonner
import { toast as sonnerToast } from "sonner";

interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const toast = ({ title, description, variant }: ToastProps) => {
    const message = title || description || "";
    const fullMessage = title && description ? `${title}: ${description}` : message;

    if (variant === "destructive") {
      sonnerToast.error(fullMessage);
    } else {
      sonnerToast.success(fullMessage);
    }
  };

  return { toast };
}
