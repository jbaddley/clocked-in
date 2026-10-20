import { authenticate } from "@/lib/api/access";

export function authenticateMcp(request: Request) {
  return authenticate(request);
}
