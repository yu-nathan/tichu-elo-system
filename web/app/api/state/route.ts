import { getAppData } from "@/lib/store";

export const GET = async () => {
  return Response.json(await getAppData());
};
