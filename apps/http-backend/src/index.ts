import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { middleware } from "./middleware";
import { JwT_SECRET } from "@repo/backend-common/config";
import { signupSchema , signinSchema , CreateroomSchema} from "@repo/common/types";
import { prismaClient } from "@repo/database/client";

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? "")
    .split(",")
    .map(origin => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

const allowAllOrigins = corsOrigins.length === 0;

async function resolveRoom(roomIdParam: string | string[] | undefined) {
    if (!roomIdParam || Array.isArray(roomIdParam)) return null;
    const numericId = Number(roomIdParam);
    if (!isNaN(numericId) && Number.isInteger(numericId)) {
        return prismaClient.room.findUnique({ where: { id: numericId } });
    }
    return prismaClient.room.findUnique({ where: { slug: roomIdParam } });
}

app.use(cors({
    origin: allowAllOrigins ? true : corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());


app.post('/signup', async (req, res) => {
    const validatedData = signupSchema.safeParse(req.body);

    if (!validatedData.success) {
        res.status(400).json({
            message: "Incorrect Inputs",
            errors: validatedData.error.issues.map(err => ({
                message: err.message,
            }))
        });
        return;
    }

    try {
        const existingUser = await prismaClient.user.findUnique({
            where: {
                email: validatedData.data.email
            }
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already exists"
            });
        }

        const hashedPass = await bcrypt.hash(validatedData.data.password, 10);

        await prismaClient.user.create({
            data: {
                username: validatedData.data.username,
                password: hashedPass,
                email: validatedData.data.email
            }
        })

        res.status(201).json({     
            message: "User created successfully",
            username: validatedData.data.username,
            email: validatedData.data.email
        });
    } catch (e){
        return res.status(500).json({
            message: "Internal server error"
        });
    }
})

app.post('/signin',async (req,res)=>{
    const validatedData = signinSchema.safeParse(req.body);

    if (!validatedData.success) {
        res.status(400).json({
            message: "Incorrect Inputs"
        });
        return;
    }

    try {
        const user = await prismaClient.user.findFirst({
            where: {
                username: validatedData.data.username
            }
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        const passwordMatch = await bcrypt.compare(validatedData.data.password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        const token = jwt.sign({
            userId: user.id
        }, JwT_SECRET);

        res.json({
            token,
        });

    } catch (e) {
        console.error("Signin error:", e);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
})

app.get("/api/v1/user/search", middleware, async (req, res) => {
    try {
        const email = req.query.email as string;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await prismaClient.user.findUnique({
            where: { email: email },
            select: {
                id: true,
                username: true,
                email: true
            }
        });

        res.json({
            success: true,
            user: user || null
        });
    } catch (error) {
        console.error("Error searching user:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.post('/room',middleware,async (req,res)=>{
    const validatedData = CreateroomSchema.safeParse(req.body);

    if (!validatedData.success) {
        res.status(400).json({
            message: "Incorrect Inputs",
            errors: validatedData.error.issues.map(err => ({
                message: err.message,
            }))
        });
        return;
    }

    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({
            message: "Login to create a room"
        });
    }
    try {
        const room = await prismaClient.room.create({
            data:{
                slug:validatedData.data.name,
                adminId:userId,
                members: {
                    create: {
                        userId: userId
                    }
                }
            }
        })

        res.json({
            roomId: room.id,
            slug: room.slug
        })
        
    } catch (error) {
        res.status(411).json({
            message:"Room name already exists"
        })
        return;
        
    }
    

    
})

app.get("/chats/:roomId", async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);
        console.log(req.params.roomId);
        const messages = await prismaClient.chat.findMany({
            where: {
                roomId: roomId
            },
            orderBy: {
                id: "desc"
            },
            take: 100
        });

        res.json({
            messages
        })
    } catch(e) {
        console.log(e);
        res.json({
            messages: []
        })
    }
    
})

app.get("/room/:slug", async (req, res) => {
    const roomIdParam = req.params.slug;
    const room = await resolveRoom(roomIdParam);

    if (!room) {
        return res.status(404).json({
            error: "Room not found"
        });
    }

    res.json({
        room
    })
})

app.get("/api/v1/room/:roomId/access", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                hasAccess: false,
                message: "Unauthorized"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                hasAccess: false,
                message: "Room not found"
            });
        }

        if (room.adminId === userId) {
            return res.json({ hasAccess: true, isAdmin: true });
        }

        const membership = await prismaClient.roomMember.findUnique({
            where: {
                roomId_userId: {
                    roomId: room.id,
                    userId: userId
                }
            }
        });

        res.json({
            hasAccess: !!membership,
            isAdmin: false
        });
    } catch (error) {
        console.error("Error checking room access:", error);
        res.status(500).json({
            hasAccess: false,
            message: "Internal server error"
        });
    }
})

app.post("/api/v1/room/:roomId/join", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const roomId = room.id;

        if (room.adminId === userId) {
            await prismaClient.roomMember.upsert({
                where: { roomId_userId: { roomId, userId } },
                create: { roomId, userId },
                update: {}
            });
            return res.json({
                success: true,
                status: "approved",
                message: "Admin has automatic access"
            });
        }

        const existingMembership = await prismaClient.roomMember.findUnique({
            where: {
                roomId_userId: {
                    roomId: room.id,
                    userId: userId
                }
            }
        });

        if (existingMembership) {
            return res.json({
                success: true,
                status: "approved",
                message: "Already a member"
            });
        }

        const existingRequest = await prismaClient.joinRequest.findUnique({
            where: {
                roomId_userId: {
                    roomId: room.id,
                    userId: userId
                }
            }
        });

        if (existingRequest) {
            if (existingRequest.status === "pending") {
                return res.json({
                    success: true,
                    status: "pending",
                    message: "Request pending approval"
                });
            }
            if (existingRequest.status === "rejected") {
                const updatedRequest = await prismaClient.joinRequest.update({
                    where: { id: existingRequest.id },
                    data: { status: "pending" },
                    include: {
                        user: {
                            select: { id: true, username: true, email: true }
                        }
                    }
                });
                return res.json({
                    success: true,
                    status: "pending",
                    message: "Join request re-submitted, waiting for admin approval",
                    requestId: updatedRequest.id,
                    adminId: room.adminId,
                    requesterInfo: {
                        id: updatedRequest.user.id,
                        username: updatedRequest.user.username,
                        email: updatedRequest.user.email
                    }
                });
            }
            return res.json({
                success: true,
                status: existingRequest.status,
                message: `Request ${existingRequest.status}`
            });
        }

        const joinRequest = await prismaClient.joinRequest.create({
            data: {
                roomId: room.id,
                userId: userId,
                status: "pending"
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        console.log(`[JOIN REQUEST] Created for room ${room.id} (slug: ${room.slug})`);
        console.log(`[JOIN REQUEST] Admin ID: ${room.adminId} (type: ${typeof room.adminId})`);
        console.log(`[JOIN REQUEST] Requester ID: ${joinRequest.user.id} (type: ${typeof joinRequest.user.id})`);

        res.json({
            success: true,
            status: "pending",
            message: "Join request created, waiting for admin approval",
            requestId: joinRequest.id,
            adminId: room.adminId,
            requesterInfo: {
                id: joinRequest.user.id,
                username: joinRequest.user.username,
                email: joinRequest.user.email
            }
        });
    } catch (error) {
        console.error("Error creating join request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.get("/api/v1/room/:roomId/requests", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const roomId = room.id;

        if (room.adminId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can view join requests"
            });
        }

        const requests = await prismaClient.joinRequest.findMany({
            where: {
                roomId: roomId,
                status: "pending"
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: "asc"
            }
        });

        res.json({
            success: true,
            requests: requests
        });
    } catch (error) {
        console.error("Error fetching join requests:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.post("/api/v1/room/request/:requestId/approve", middleware, async (req, res) => {
    try {
        const requestId = Number(req.params.requestId);
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const joinRequest = await prismaClient.joinRequest.findUnique({
            where: { id: requestId },
            include: {
                room: true
            }
        });

        if (!joinRequest) {
            return res.status(404).json({
                success: false,
                message: "Join request not found"
            });
        }

        if (joinRequest.room.adminId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can approve join requests"
            });
        }

        if (joinRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Request already ${joinRequest.status}`
            });
        }

        await prismaClient.joinRequest.update({
            where: { id: requestId },
            data: { status: "approved" }
        });

        const existingMember = await prismaClient.roomMember.findFirst({
            where: {
                roomId: joinRequest.roomId,
                userId: joinRequest.userId
            }
        });

        if (!existingMember) {
            await prismaClient.roomMember.create({
                data: {
                    roomId: joinRequest.roomId,
                    userId: joinRequest.userId
                }
            });
        }

        const user = await prismaClient.user.findUnique({
            where: { id: joinRequest.userId }
        });

        res.json({
            success: true,
            message: "Join request approved",
            userId: joinRequest.userId,
            roomId: joinRequest.roomId,
            username: user?.username || "Unknown User"
        });
    } catch (error) {
        console.error("Error approving join request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.post("/api/v1/room/request/:requestId/reject", middleware, async (req, res) => {
    try {
        const requestId = Number(req.params.requestId);
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const joinRequest = await prismaClient.joinRequest.findUnique({
            where: { id: requestId },
            include: {
                room: true
            }
        });

        if (!joinRequest) {
            return res.status(404).json({
                success: false,
                message: "Join request not found"
            });
        }

        if (joinRequest.room.adminId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can reject join requests"
            });
        }

        if (joinRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Request already ${joinRequest.status}`
            });
        }

        await prismaClient.joinRequest.update({
            where: { id: requestId },
            data: { status: "rejected" }
        });

        res.json({
            success: true,
            message: "Join request rejected",
            userId: joinRequest.userId,
            roomId: joinRequest.roomId
        });
    } catch (error) {
        console.error("Error rejecting join request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.get("/api/v1/room/:roomId/request-status", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const joinRequest = await prismaClient.joinRequest.findUnique({
            where: {
                roomId_userId: {
                    roomId: room.id,
                    userId: userId
                }
            }
        });

        res.json({
            success: true,
            hasRequest: !!joinRequest,
            status: joinRequest?.status || null
        });
    } catch (error) {
        console.error("Error checking join request status:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.get("/api/v1/room/:roomId/members", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const roomId = room.id;

        const isAdmin = room.adminId === userId;
        const isMember = isAdmin || !!(await prismaClient.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId } }
        }));

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this room"
            });
        }

        const members = await prismaClient.roomMember.findMany({
            where: {
                roomId: roomId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            },
            orderBy: {
                joinedAt: "asc"
            }
        });

        res.json({
            success: true,
            members: members.map(m => ({
                id: m.id,
                userId: m.userId,
                username: m.user.username,
                email: m.user.email,
                joinedAt: m.joinedAt,
                isAdmin: m.userId === room.adminId
            }))
        });
    } catch (error) {
        console.error("Error fetching members:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.post("/api/v1/room/:roomId/member/:targetUserId/add", middleware, async (req, res) => {
    try {
        const targetUserId = typeof req.params.targetUserId === 'string' ? req.params.targetUserId : '';
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: "Target user ID is required"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const roomId = room.id;

        if (room.adminId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can add members"
            });
        }

        const targetUser = await prismaClient.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                username: true,
                email: true
            }
        });

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const existingMembership = await prismaClient.roomMember.findUnique({
            where: {
                roomId_userId: {
                    roomId: roomId,
                    userId: targetUserId
                }
            }
        });

        if (existingMembership) {
            return res.json({
                success: true,
                message: "User is already a member"
            });
        }

        await prismaClient.roomMember.create({
            data: {
                roomId: roomId,
                userId: targetUserId
            }
        });

        res.json({
            success: true,
            message: "User added successfully",
            userId: targetUserId,
            username: targetUser.username,
            roomId: roomId
        });
    } catch (error) {
        console.error("Error adding member:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.delete("/api/v1/room/:roomId/member/:targetUserId/remove", middleware, async (req, res) => {
    try {
        const targetUserId = typeof req.params.targetUserId === 'string' ? req.params.targetUserId : '';
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: "Target user ID is required"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const roomId = room.id;

        if (room.adminId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can remove members"
            });
        }

        if (targetUserId === userId) {
            return res.status(400).json({
                success: false,
                message: "Admin cannot remove themselves"
            });
        }

        const deleted = await prismaClient.roomMember.deleteMany({
            where: {
                roomId: roomId,
                userId: targetUserId
            }
        });

        if (deleted.count === 0) {
            return res.status(404).json({
                success: false,
                message: "User is not a member of this room"
            });
        }

        await prismaClient.joinRequest.deleteMany({
            where: {
                roomId: roomId,
                userId: targetUserId
            }
        });

        console.log(`[REMOVE MEMBER] User ${targetUserId} removed from room ${roomId}, join requests deleted`);

        res.json({
            success: true,
            message: "User removed successfully",
            userId: targetUserId,
            roomId: roomId
        });
    } catch (error) {
        console.error("Error removing member:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.delete("/api/v1/room/:roomId/delete", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const roomId = room.id;

        if (room.adminId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can delete the room"
            });
        }

        const members = await prismaClient.roomMember.findMany({
            where: { roomId: roomId },
            select: { userId: true }
        });

        const memberIds = members.map(m => m.userId);

        await prismaClient.drawing.deleteMany({
            where: { roomId: roomId }
        });

        await prismaClient.chat.deleteMany({
            where: { roomId: roomId }
        });

        await prismaClient.room.delete({
            where: { id: roomId }
        });

        console.log(`[DELETE ROOM] Room ${roomId} deleted by admin ${userId}`);

        res.json({
            success: true,
            message: "Room deleted successfully",
            roomId: roomId,
            memberIds: memberIds
        });
    } catch (error) {
        console.error("Error deleting room:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.get("/api/v1/drawings/:roomId", async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);
        
        if (isNaN(roomId)) {
            return res.status(400).json({
                error: "Invalid room ID",
                drawings: []
            });
        }

        const drawings = await prismaClient.drawing.findMany({
            where: {
                roomId: roomId
            },
            orderBy: {
                createdAt: "asc"
            }
        });

        const formattedDrawings = drawings.map(drawing => {
            try {
                return {
                    id: drawing.id,
                    roomId: drawing.roomId,
                    senderId: drawing.userId,
                    shapeType: drawing.shapeType,
                    shapeData: JSON.parse(drawing.shapeData)
                };
            } catch (parseError) {
                console.error("Error parsing shapeData:", parseError);
                return null;
            }
        }).filter(d => d !== null);

        res.json({
            drawings: formattedDrawings
        });
    } catch (error) {
        console.error("Error fetching drawings:", error);
        res.status(500).json({
            error: "Failed to fetch drawings",
            drawings: [],
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
})

app.get("/api/v1/user/rooms", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const memberships = await prismaClient.roomMember.findMany({
            where: {
                userId: userId
            },
            include: {
                room: {
                    include: {
                        admin: {
                            select: {
                                id: true,
                                username: true
                            }
                        },
                        _count: {
                            select: {
                                members: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                joinedAt: "desc"
            }
        });

        const rooms = memberships.map(m => ({
            id: m.room.id,
            slug: m.room.slug,
            backgroundColor: m.room.backgroundColor,
            createdAt: m.room.createdAt,
            joinedAt: m.joinedAt,
            isAdmin: m.room.adminId === userId,
            adminName: m.room.admin.username,
            memberCount: m.room._count.members
        }));

        res.json({
            success: true,
            rooms: rooms
        });
    } catch (error) {
        console.error("Error fetching user rooms:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.get("/api/v1/user/pending-requests-count", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const adminRooms = await prismaClient.room.findMany({
            where: {
                adminId: userId
            },
            select: {
                id: true
            }
        });

        const roomIds = adminRooms.map(r => r.id);

        const pendingCount = await prismaClient.joinRequest.count({
            where: {
                roomId: {
                    in: roomIds
                },
                status: "pending"
            }
        });

        const requestsByRoom = await prismaClient.joinRequest.groupBy({
            by: ['roomId'],
            where: {
                roomId: {
                    in: roomIds
                },
                status: "pending"
            },
            _count: true
        });

        res.json({
            success: true,
            totalPending: pendingCount,
            byRoom: requestsByRoom.map(r => ({
                roomId: r.roomId,
                count: r._count
            }))
        });
    } catch (error) {
        console.error("Error fetching pending requests count:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.get("/api/v1/user/pending-requests", middleware, async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const adminRooms = await prismaClient.room.findMany({
            where: {
                adminId: userId
            },
            select: {
                id: true,
                slug: true
            }
        });

        const roomIds = adminRooms.map(r => r.id);

        const requests = await prismaClient.joinRequest.findMany({
            where: {
                roomId: {
                    in: roomIds
                },
                status: "pending"
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                room: {
                    select: {
                        slug: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        const formattedRequests = requests.map(req => ({
            roomId: String(req.roomId),
            roomSlug: req.room.slug,
            requestId: req.id,
            requester: {
                id: req.userId,
                username: req.user.username,
                email: req.user.email
            },
            createdAt: req.createdAt
        }));

        res.json({
            success: true,
            requests: formattedRequests
        });
    } catch (error) {
        console.error("Error fetching pending requests:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

app.put("/api/v1/room/:roomId/background", middleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { backgroundColor } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        if (!backgroundColor || typeof backgroundColor !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Valid backgroundColor is required"
            });
        }

        const room = await resolveRoom(req.params.roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        if (room.adminId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can change background color"
            });
        }

        await prismaClient.room.update({
            where: { id: room.id },
            data: { backgroundColor }
        });

        res.json({
            success: true,
            message: "Background color updated",
            backgroundColor
        });
    } catch (error) {
        console.error("Error updating background color:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})


const PORT = process.env.PORT ? Number(process.env.PORT) : 3005;

app.listen(PORT, () => {
    console.log(`HTTP backend running on port ${PORT}`);
})