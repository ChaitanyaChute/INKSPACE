import { WebSocket, WebSocketServer } from 'ws';
import jwt, { JwtPayload } from "jsonwebtoken";
import { prismaClient } from "@repo/database/client";
import { JwT_SECRET } from '@repo/backend-common/config';

const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket,
  rooms: string[],
  userId: string
}

interface QueuedMessage {
  roomId: number;
  message: string;
  userId: string;
  timestamp: Date;
}

const users: User[] = [];
const messageQueue: QueuedMessage[] = [];
let isProcessingQueue = false;

// Queue configuration
const BATCH_SIZE = 10;          
const BATCH_INTERVAL = 2000;   

async function processMessageQueue() {
  if (isProcessingQueue || messageQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  try {
    const batch = messageQueue.splice(0, BATCH_SIZE);
    
    await prismaClient.chat.createMany({
      data: batch.map(msg => ({
        roomId: msg.roomId,
        message: msg.message,
        userId: msg.userId
      }))
    });

    console.log(` Saved ${batch.length} messages to database`);
  } catch (error) {
    console.error("Error processing message queue:", error);
  } finally {
    isProcessingQueue = false;
  }
}

setInterval(processMessageQueue, BATCH_INTERVAL);

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JwT_SECRET);

    if (typeof decoded === "string") {
      return null;
    }

    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  } catch(e) {
    return null;
  }
}

wss.on('connection', function connection(ws, request) {
  const url = request.url;
  if (!url) {
    return;
  }
  const queryParams = new URLSearchParams(url.split('?')[1]);  
  //this will split url into array and get the query part 
  // for example if url is www.chait8nya.me/?token=abc then it will split into ["www.chait8nya.me/","token=abc"] 
  // and we will get the second part which is query string and then we will parse it using URLSearchParams to get the token value
  const token = queryParams.get('token') || "";
  const userId = checkUser(token);

  if (userId === null) {
    ws.close()
    return;
  }

  users.push({
    userId,
    rooms: [],
    ws
  })

  ws.on('message', async function message(data) {
    try {
      let parsedData;
      if (typeof data !== "string") {
        parsedData = JSON.parse(data.toString());
      } else {
        parsedData = JSON.parse(data); 
      }

      if (parsedData.type === "join_room") {
        const user = users.find(x => x.ws === ws);
        const roomId = String(parsedData.roomId);
        
        if (user && !user.rooms.includes(roomId)) {
          user.rooms.push(roomId);
          
          ws.send(JSON.stringify({
            type: "room_joined",
            roomId: roomId
          }));
        }
      }

      if (parsedData.type === "leave_room") {
        const user = users.find(x => x.ws === ws);
        if (!user) {
          return;
        }
        const roomId = String(parsedData.roomId);
        user.rooms = user.rooms.filter(x => x !== roomId);
      }

      if (parsedData.type === "chat") {
        const roomId = String(parsedData.roomId);
        const message = parsedData.message;

        messageQueue.push({
          roomId: Number(roomId),
          message,
          userId,
          timestamp: new Date()
        });

        if (messageQueue.length >= BATCH_SIZE) {
          processMessageQueue();
        }

        users.forEach(user => {
          if (user.rooms.includes(roomId) && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify({
              type: "chat",
              message: message,
              roomId: roomId,
              userId: userId
            }));
          }
        });
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format"
      }));
    }
  });

  ws.on('close', function close() {
    const index = users.findIndex(x => x.ws === ws);
    if (index !== -1) {
      users.splice(index, 1);
    }
  });

});