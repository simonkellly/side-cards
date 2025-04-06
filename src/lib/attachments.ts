import { BASE_PATH } from "@/constants";
import { usePluginStore } from "./plugin-store";
import { nanoid } from "nanoid";

export async function uploadAttachment(file: File): Promise<string> {
  const plugin = usePluginStore .getState().plugin;

  const fileArrayBuffer = await file.arrayBuffer();
  const savedFile = await plugin.app.vault.createBinary(
    BASE_PATH + "/" + nanoid() + file.name,
    fileArrayBuffer
  );

  return savedFile.path;
}