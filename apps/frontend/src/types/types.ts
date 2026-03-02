export enum Tool {
  SELECTION = "selection",
  HAND = "hand",
  RECT = "rect",
  DIAMOND = "diamond",
  CIRCLE = "circle",
  TRIANGLE = "triangle",
  STAR = "star",
  HEXAGON = "hexagon",
  PENTAGON = "pentagon",
  ARROW = "arrow",
  LINE = "line",
  PENCIL = "pencil",
  TEXT = "text",
  ERASER = "eraser",
  UNDO = "undo",
}

export enum ShapeType {
  RECT = "RECT",
  DIAMOND = "DIAMOND",
  CIRCLE = "CIRCLE",
  LINE = "LINE",
  ARROW = "ARROW",
  PENCIL = "PENCIL",
  TEXT = "TEXT",
}

export type Rect = { x: number; y: number; width: number; height: number };
export type Circle = { x: number; y: number; radius: number };
export type Pencil = { points: { x: number; y: number }[] };

export type DrawingBase = {
  id: number;
  roomId: number;
  senderId: string;
  shapeType: ShapeType.RECT | ShapeType.CIRCLE | ShapeType.PENCIL;
  rectId?: string | null;
  circleId?: string | null;
  pencilId?: string | null;
};

export type Drawing =
  | (DrawingBase & { shapeType: ShapeType.RECT; rect: Rect; circle: null; pencil: null })
  | (DrawingBase & { shapeType: ShapeType.CIRCLE; rect: null; circle: Circle; pencil: null })
  | (DrawingBase & { shapeType: ShapeType.PENCIL; rect: null; circle: null; pencil: Pencil });
