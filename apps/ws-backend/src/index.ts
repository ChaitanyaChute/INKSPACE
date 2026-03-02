import { WebSocket, WebSocketServer } from 'ws';
import jwt, { JwtPayload } from "jsonwebtoken";
import { prismaClient } from "@repo/database/client";
import { JwT_SECRET } from '@repo/backend-common/config';

const WS_PORT = process.env.PORT ? Number(process.env.PORT) : 8085;
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`WebSocket server running on port ${WS_PORT}`);

interface User {
  ws: WebSocket,
  rooms: string[],
  userId: string,
  onDashboard: boolean
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
  const token = queryParams.get('token') || "";
  const userId = checkUser(token);

  if (userId === null) {
    ws.close()
    return;
  }

  users.push({
    userId,
    rooms: [],
    ws,
    onDashboard: false
  })

  console.log(`\n[WS CONNECT] User ID from JWT: ${userId} (type: ${typeof userId})`);
  console.log(`[WS CONNECT] Total connected users: ${users.length}\n`);

  ws.on('error', (error) => {
    console.error(`\n[WS ERROR] User ${userId}:`, error, '\n');
  });

  ws.on('close', (code, reason) => {
    console.log(`\n[WS DISCONNECT] User ${userId}, Code: ${code}, Reason: ${reason || 'none'}\n`);
  });

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
        const roomIdRaw = parsedData.roomId;
        
        if (roomIdRaw === null || roomIdRaw === undefined || isNaN(Number(roomIdRaw))) {
          console.log(`\n===== JOIN ROOM REQUEST REJECTED =====`);
          console.log(`User ${userId} attempted with invalid roomId: ${roomIdRaw}`);
          console.log(`Type: ${typeof roomIdRaw}, Value: ${roomIdRaw}`);
          console.log(`=======================================\n`);
          ws.send(JSON.stringify({
            type: "error",
            message: "Invalid room ID"
          }));
          return;
        }
        
        const roomId = String(roomIdRaw);
        
        console.log(`\n===== JOIN ROOM REQUEST =====`);
        console.log(`User ${userId} attempting to join room ${roomId}`);
        console.log(`User found: ${!!user}`);
        
        if (user) {
          console.log(`User's current rooms: [${user.rooms.join(', ')}]`);
          console.log(`Already in room: ${user.rooms.includes(roomId)}`);
          
          if (!user.rooms.includes(roomId)) {
            user.rooms.push(roomId);
            console.log(`✓ User ${userId} added to room ${roomId}`);
            console.log(`  Updated rooms: [${user.rooms.join(', ')}]`);
            console.log(`  Total users in room ${roomId}: ${users.filter(u => u.rooms.includes(roomId)).length}`);
            
            users.filter(u => u.rooms.includes(roomId)).forEach((u, i) => {
              console.log(`    ${i+1}. ${u.userId}`);
            });
          
            ws.send(JSON.stringify({
              type: "room_joined",
              roomId: roomId
            }));
            console.log(`✓ Sent room_joined confirmation`);
          } else {
            console.log(`! User already in room ${roomId}`);
          }
        } else {
          console.log(`✗ User not found in users array!`);
        }
        console.log(`=============================\n`);
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

      if (parsedData.type === "draw") {
        const roomIdRaw = parsedData.roomId;
        
        if (roomIdRaw === null || roomIdRaw === undefined || isNaN(Number(roomIdRaw))) {
          console.log(`\n========== DRAW MESSAGE REJECTED ==========`);
          console.log(`User ${userId} attempted draw with invalid roomId: ${roomIdRaw}`);
          console.log(`Type: ${typeof roomIdRaw}, Value: ${roomIdRaw}`);
          console.log(`===========================================\n`);
          return;
        }
        
        const roomId = String(roomIdRaw);
        const shapeData = parsedData.shapeData;
        const shapeType = parsedData.shapeType;

        console.log(`\n${'='.repeat(50)}`);
        console.log(`📥 DRAW MESSAGE RECEIVED`);
        console.log(`${'='.repeat(50)}`);
        console.log(`Room: ${roomId}`);
        console.log(`Shape: ${shapeType}`);
        console.log(`Sender: ${userId}`);
        console.log(`Total connected users: ${users.length}`);
        console.log(`\nAll users and their rooms:`);
        
        users.forEach((u, index) => {
          console.log(`  ${index + 1}. userId=${u.userId}, rooms=[${u.rooms.join(', ')}], wsState=${u.ws.readyState === 1 ? 'OPEN' : 'CLOSED'}`);
        });

        try {
          await prismaClient.drawing.create({
            data: {
              roomId: Number(roomId),
              userId: userId,
              shapeId: shapeData.id,
              shapeType: shapeType,
              shapeData: JSON.stringify(shapeData)
            }
          });
          console.log(`\n✅ Saved to database with shapeId: ${shapeData.id}`);
        } catch (error) {
          console.error("\n❌ Database save error:", error);
        }

        console.log(`\n🔍 Finding recipients in room ${roomId}:`);
        const potentialRecipients = users.filter(user => {
          const isInRoom = user.rooms.includes(roomId);
          const symbol = isInRoom ? '✓' : '✗';
          console.log(`  ${symbol} User ${user.userId}: rooms=[${user.rooms.join(', ')}], in room '${roomId}': ${isInRoom}`);
          return isInRoom;
        });
        const activeRecipients = potentialRecipients.filter(user => user.ws.readyState === WebSocket.OPEN);
        const finalRecipients = activeRecipients.filter(user => user.userId !== userId);
        
        console.log(`\n📊 Recipient Summary:`);
        console.log(`  Users in room ${roomId}: ${potentialRecipients.length}`);
        console.log(`  Users with active connection: ${activeRecipients.length}`);
        console.log(`  Final recipients (excluding sender ${userId}): ${finalRecipients.length}`);
        
        if (finalRecipients.length > 0) {
          console.log(`\n📤 Broadcasting to ${finalRecipients.length} recipient(s):`);
          finalRecipients.forEach((user, index) => {
            console.log(`  ${index + 1}. Broadcasting to: ${user.userId}`);
            try {
              user.ws.send(JSON.stringify({
                type: "draw",
                shapeData: shapeData,
                shapeType: shapeType,
                roomId: roomId,
                userId: userId
              }));
              console.log(`     ✅ Message sent successfully`);
            } catch (error) {
              console.log(`     ❌ Failed to send:`, error);
            }
          });
        } else {
          console.log(`\n⚠️  No recipients to broadcast to (sender is only user in room or drawing alone)`);
        }
        
        console.log(`${'='.repeat(50)}\n`);
      }

      if (parsedData.type === "delete_shapes") {
        const roomId = String(parsedData.roomId);
        const shapeIds = parsedData.shapeIds;

        console.log(`\n${'='.repeat(50)}`);
        console.log(`🗑️  DELETE SHAPES MESSAGE RECEIVED`);
        console.log(`${'='.repeat(50)}`);
        console.log(`Room: ${roomId}`);
        console.log(`Sender: ${userId}`);
        console.log(`Shape IDs to delete: ${shapeIds}`);

        try {
          const deleteResult = await prismaClient.drawing.deleteMany({
            where: {
              roomId: Number(roomId),
              shapeId: {
                in: shapeIds
              }
            }
          });
          console.log(`✅ Deleted ${deleteResult.count} shape(s) from database`);
        } catch (error) {
          console.error("❌ Database delete error:", error);
        }

        const recipients = users.filter(user => 
          user.rooms.includes(roomId) && 
          user.ws.readyState === WebSocket.OPEN && 
          user.userId !== userId
        );

        console.log(`📤 Broadcasting delete to ${recipients.length} recipient(s)`);
        recipients.forEach((user, index) => {
          console.log(`  ${index + 1}. Broadcasting to: ${user.userId}`);
          try {
            user.ws.send(JSON.stringify({
              type: "delete_shapes",
              roomId: roomId,
              shapeIds: shapeIds,
              userId: userId
            }));
            console.log(`     ✅ Delete message sent successfully`);
          } catch (error) {
            console.log(`     ❌ Failed to send:`, error);
          }
        });
        
        console.log(`${'='.repeat(50)}\n`);
      }

      if (parsedData.type === "update_shape") {
        const roomId = String(parsedData.roomId);
        const shapeId = parsedData.shapeId;
        const shapeData = parsedData.shapeData;

        console.log(`\n${'='.repeat(50)}`);
        console.log(`🔄 UPDATE SHAPE MESSAGE RECEIVED`);
        console.log(`${'='.repeat(50)}`);
        console.log(`Room: ${roomId}`);
        console.log(`Sender: ${userId}`);
        console.log(`Shape ID: ${shapeId}`);
        console.log(`Shape type: ${shapeData?.type}`);

        try {
          const updateResult = await prismaClient.drawing.updateMany({
            where: {
              roomId: Number(roomId),
              shapeId: shapeId
            },
            data: {
              shapeData: JSON.stringify(shapeData)
            }
          });
          console.log(`✅ Updated ${updateResult.count} shape(s) in database`);
        } catch (error) {
          console.error("❌ Database update error:", error);
        }

        const recipients = users.filter(user => 
          user.rooms.includes(roomId) && 
          user.ws.readyState === WebSocket.OPEN && 
          user.userId !== userId
        );

        console.log(`📤 Broadcasting update to ${recipients.length} recipient(s)`);
        recipients.forEach((user, index) => {
          console.log(`  ${index + 1}. Broadcasting to: ${user.userId}`);
          try {
            user.ws.send(JSON.stringify({
              type: "update_shape",
              roomId: roomId,
              shapeId: shapeId,
              shapeData: shapeData,
              userId: userId
            }));
            console.log(`     ✅ Update message sent successfully`);
          } catch (error) {
            console.log(`     ❌ Failed to send:`, error);
          }
        });
        
        console.log(`${'='.repeat(50)}\n`);
      }

      if (parsedData.type === "clear_canvas") {
        const roomId = String(parsedData.roomId);

        console.log(`\n${'='.repeat(50)}`);
        console.log(`🗑️  CLEAR CANVAS MESSAGE RECEIVED`);
        console.log(`${'='.repeat(50)}`);
        console.log(`Room: ${roomId}`);
        console.log(`Sender: ${userId}`);

        try {
          const deleteResult = await prismaClient.drawing.deleteMany({
            where: {
              roomId: Number(roomId)
            }
          });
          console.log(`✅ Deleted ${deleteResult.count} drawing(s) from database`);
        } catch (error) {
          console.error("❌ Database delete error:", error);
        }

        const recipients = users.filter(user => 
          user.rooms.includes(roomId) && 
          user.ws.readyState === WebSocket.OPEN && 
          user.userId !== userId
        );

        console.log(`📤 Broadcasting clear to ${recipients.length} recipient(s)`);
        recipients.forEach((user, index) => {
          console.log(`  ${index + 1}. Broadcasting to: ${user.userId}`);
          try {
            user.ws.send(JSON.stringify({
              type: "clear_canvas",
              roomId: roomId,
              userId: userId
            }));
            console.log(`     ✅ Clear message sent successfully`);
          } catch (error) {
            console.log(`     ❌ Failed to send:`, error);
          }
        });
        
        console.log(`${'='.repeat(50)}\n`);
      }

      if (parsedData.type === "sync_shapes") {
        const roomId = String(parsedData.roomId);
        const shapes = parsedData.shapes || [];

        console.log(`\n${'='.repeat(50)}`);
        console.log(`🔄 SYNC SHAPES (UNDO) MESSAGE RECEIVED`);
        console.log(`${'='.repeat(50)}`);
        console.log(`Room: ${roomId}`);
        console.log(`Sender: ${userId}`);
        console.log(`Shape count: ${shapes.length}`);

        try {
          await prismaClient.drawing.deleteMany({ where: { roomId: Number(roomId) } });
          if (shapes.length > 0) {
            await prismaClient.drawing.createMany({
              data: shapes.map((s: any) => ({
                roomId: Number(roomId),
                userId: userId,
                shapeId: s.id || null,
                shapeType: s.type.toUpperCase(),
                shapeData: JSON.stringify(s)
              }))
            });
          }
          console.log(`✅ Database synced with ${shapes.length} shape(s)`);
        } catch (error) {
          console.error("❌ Database sync error:", error);
        }

        const recipients = users.filter(user =>
          user.rooms.includes(roomId) &&
          user.ws.readyState === WebSocket.OPEN &&
          user.userId !== userId
        );

        console.log(`📤 Broadcasting sync to ${recipients.length} recipient(s)`);
        recipients.forEach((user, index) => {
          console.log(`  ${index + 1}. Broadcasting to: ${user.userId}`);
          try {
            user.ws.send(JSON.stringify({
              type: "sync_shapes",
              roomId: roomId,
              shapes: shapes,
              userId: userId
            }));
            console.log(`     ✅ Sync message sent successfully`);
          } catch (error) {
            console.log(`     ❌ Failed to send:`, error);
          }
        });

        console.log(`${'='.repeat(50)}\n`);
      }

      if (parsedData.type === "notify_admin") {
        const roomId = String(parsedData.roomId);
        const requestId = parsedData.requestId;
        const adminId = parsedData.adminId;
        const requesterInfo = parsedData.requesterInfo;

        console.log(`\n===== JOIN REQUEST NOTIFICATION =====`);
        console.log(`Room: ${roomId}, Requester: ${requesterInfo.username}, Admin: ${adminId}`);
        console.log(`Request ID: ${requestId}`);
        console.log(`Total connected users: ${users.length}`);
        
        users.forEach((u, idx) => {
          console.log(`  User ${idx + 1}: ID=${u.userId}, Dashboard=${u.onDashboard}, Rooms=[${u.rooms.join(', ')}], WS State=${u.ws.readyState}`);
        });

        const adminUser = users.find(u => u.userId === adminId);
        
        console.log(`Admin search result: ${adminUser ? 'FOUND' : 'NOT FOUND'}`);
        if (adminUser) {
          console.log(`Admin WS state: ${adminUser.ws.readyState} (OPEN=1, CLOSED=3)`);
        }
        
        if (adminUser && adminUser.ws.readyState === WebSocket.OPEN) {
          const notificationPayload = {
            type: "join_request",
            roomId: roomId,
            requestId: requestId,
            requester: requesterInfo
          };
          console.log(`Sending notification payload:`, JSON.stringify(notificationPayload));
          adminUser.ws.send(JSON.stringify(notificationPayload));
          console.log(`✓ Notification sent to admin (Dashboard: ${adminUser.onDashboard}, Canvas: ${adminUser.rooms.includes(roomId)})`);
        } else {
          console.log(`! Admin offline or WebSocket not ready`);
          if (!adminUser) {
            console.log(`! Admin with ID ${adminId} not found in connected users`);
          } else if (adminUser.ws.readyState !== WebSocket.OPEN) {
            console.log(`! Admin WebSocket state is ${adminUser.ws.readyState} (expected 1 for OPEN)`);
          }
        }
        console.log(`=====================================\n`);
      }

      if (parsedData.type === "approve_request") {
        const requestId = parsedData.requestId;
        const requestUserId = parsedData.requestUserId;
        const roomId = String(parsedData.roomId);

        console.log(`\n===== APPROVE JOIN REQUEST =====`);
        console.log(`Request ID: ${requestId}, User: ${requestUserId}, Room: ${roomId}`);
        console.log(`Total connected users: ${users.length}`);

        const requestingUser = users.find(u => u.userId === requestUserId);
        
        console.log(`Requesting user found: ${!!requestingUser}`);
        if (requestingUser) {
          console.log(`  User WebSocket state: ${requestingUser.ws.readyState} (OPEN=1)`);
        }
        
        if (requestingUser && requestingUser.ws.readyState === WebSocket.OPEN) {
          const approvalMessage = {
            type: "request_approved",
            roomId: roomId,
            requestId: requestId
          };
          console.log(`Sending approval message:`, JSON.stringify(approvalMessage));
          requestingUser.ws.send(JSON.stringify(approvalMessage));
          console.log(`✓ Approval notification sent to user ${requestUserId}`);
        } else {
          console.log(`! User offline or not connected - will see status when checking`);
        }
        console.log(`================================\n`);
      }

      if (parsedData.type === "reject_request") {
        const requestId = parsedData.requestId;
        const requestUserId = parsedData.requestUserId;
        const roomId = String(parsedData.roomId);

        console.log(`\n===== REJECT JOIN REQUEST =====`);
        console.log(`Request ID: ${requestId}, User: ${requestUserId}, Room: ${roomId}`);
        console.log(`Total connected users: ${users.length}`);

        const requestingUser = users.find(u => u.userId === requestUserId);
        
        console.log(`Requesting user found: ${!!requestingUser}`);
        if (requestingUser) {
          console.log(`  User WebSocket state: ${requestingUser.ws.readyState} (OPEN=1)`);
        }
        
        if (requestingUser && requestingUser.ws.readyState === WebSocket.OPEN) {
          const rejectionMessage = {
            type: "request_rejected",
            roomId: roomId,
            requestId: requestId
          };
          console.log(`Sending rejection message:`, JSON.stringify(rejectionMessage));
          requestingUser.ws.send(JSON.stringify(rejectionMessage));
          console.log(`✓ Rejection notification sent to user ${requestUserId}`);
        } else {
          console.log(`! User offline or not connected - will see status when checking`);
        }
        console.log(`===============================\n`);
      }

      if (parsedData.type === "user_added") {
        const roomId = String(parsedData.roomId);
        const addedUserId = parsedData.userId;
        const username = parsedData.username;

        console.log(`\n===== USER ADDED TO ROOM =====`);
        console.log(`Room: ${roomId}, Added User: ${addedUserId} (${username})`);

        const addedUser = users.find(u => u.userId === addedUserId);
        if (addedUser && addedUser.ws.readyState === WebSocket.OPEN) {
          addedUser.ws.send(JSON.stringify({
            type: "added_to_room",
            roomId: roomId
          }));
          console.log(`✓ Notification sent to added user`);
        }

        users.forEach(user => {
          if (user.rooms.includes(roomId) && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify({
              type: "member_added",
              roomId: roomId,
              userId: addedUserId,
              username: username
            }));
          }
        });
        console.log(`✓ Notifications sent to room members`);
        console.log(`==============================\n`);
      }

      if (parsedData.type === "user_removed") {
        const roomId = String(parsedData.roomId);
        const removedUserId = parsedData.userId;

        console.log(`\n===== USER REMOVED FROM ROOM =====`);
        console.log(`Room: ${roomId}, Removed User: ${removedUserId}`);

        const removedUser = users.find(u => u.userId === removedUserId);
        if (removedUser && removedUser.ws.readyState === WebSocket.OPEN) {
          removedUser.rooms = removedUser.rooms.filter(r => r !== roomId);
          
          removedUser.ws.send(JSON.stringify({
            type: "removed_from_room",
            roomId: roomId
          }));
          console.log(`✓ Notification sent to removed user`);
        }

        users.forEach(user => {
          if (user.rooms.includes(roomId) && user.ws.readyState === WebSocket.OPEN && user.userId !== removedUserId) {
            user.ws.send(JSON.stringify({
              type: "member_removed",
              roomId: roomId,
              userId: removedUserId
            }));
          }
        });
        console.log(`✓ Notifications sent to room members`);
        console.log(`==================================\n`);
      }

      if (parsedData.type === "room_deleted") {
        const roomId = String(parsedData.roomId);
        const memberIds = parsedData.memberIds || [];

        console.log(`\n===== ROOM DELETED =====`);
        console.log(`Room: ${roomId}`);
        console.log(`Members to notify: ${memberIds.length}`);

        memberIds.forEach((memberId: string) => {
          const member = users.find(u => u.userId === memberId);
          if (member && member.ws.readyState === WebSocket.OPEN) {
            member.rooms = member.rooms.filter(r => r !== roomId);
            
            member.ws.send(JSON.stringify({
              type: "room_deleted",
              roomId: roomId
            }));
            console.log(`✓ Room deletion notification sent to user ${memberId} (onDashboard: ${member.onDashboard})`);
          }
        });

        console.log(`========================\n`);
      }

      if (parsedData.type === "dashboard_connect") {
        const user = users.find(x => x.ws === ws);
        if (user) {
          user.onDashboard = true;
          console.log(`User ${userId} connected to dashboard`);
        }
      }

      if (parsedData.type === "dashboard_disconnect") {
        const user = users.find(x => x.ws === ws);
        if (user) {
          user.onDashboard = false;
          console.log(`User ${userId} disconnected from dashboard`);
        }
      }

      if (parsedData.type === "background_change") {
        const roomId = String(parsedData.roomId);
        const backgroundColor = parsedData.backgroundColor;

        console.log(`\n===== BACKGROUND COLOR CHANGED =====`);
        console.log(`Room: ${roomId}, New Color: ${backgroundColor}`);

        users.forEach(user => {
          if (user.rooms.includes(roomId) && user.ws.readyState === WebSocket.OPEN && user.userId !== userId) {
            user.ws.send(JSON.stringify({
              type: "background_changed",
              roomId: roomId,
              backgroundColor: backgroundColor
            }));
          }
        });
        console.log(`✓ Background change broadcasted to room members`);
        console.log(`====================================\n`);
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
      const user = users[index];
      if (user) {
        console.log(`User ${user.userId} disconnected. Total users: ${users.length - 1}`);
      }
      users.splice(index, 1);
    }
  });

});