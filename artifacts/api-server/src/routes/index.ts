import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { emailRouter } from "./email";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/email", emailRouter);

export default router;
