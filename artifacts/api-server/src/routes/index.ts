import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { emailRouter } from "./email";
import { authRouter } from "./auth";
import { adminRouter } from "./admin";
import { userRouter } from "./user";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/email", emailRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/user", userRouter);

export default router;
