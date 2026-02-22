import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { middleware } from "./middleware";
import { JwT_SECRET } from "@repo/backend-common/config";
import { signupSchema , signinSchema , CreateroomSchema} from "@repo/common/types";
import { prismaClient } from "@repo/database/client";

const app = express();
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
        return res.status(500).json({
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
                adminId:userId
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
    const slug = req.params.slug;
    const room = await prismaClient.room.findFirst({
        where: {
            slug
        }
    });

    res.json({
        room
    })
})



app.listen(3001)