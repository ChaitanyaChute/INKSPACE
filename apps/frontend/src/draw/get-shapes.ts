import axios from "axios";
import { API_URL } from "@/config";

export async function getShapesFromDb(roomId: number) {
  try {
    const res = await axios.get(`${API_URL}/api/v1/drawings/${roomId}`);
    const drawings = res.data.drawings;

    if (!Array.isArray(drawings)) {
      console.warn("Drawings data is not an array:", drawings);
      return [];
    }

    const shapes = drawings.map((d: any) => d.shapeData);

    return shapes;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Error fetching shapes:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
    } else {
      console.error("Error fetching shapes:", error);
    }
    return [];
  }
}
