import { llmsResponse, llmsText } from "@/features/software/llms";

export async function GET(): Promise<Response> {
  return llmsResponse(await llmsText(false));
}
