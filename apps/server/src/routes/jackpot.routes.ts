import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/:slug", async (req, res) => {
  try {
    const jackpot = await prisma.progressiveJackpot.findUnique({
      where: { slug: req.params.slug },
    });
    
    if (!jackpot) {
      // Initialize if not found
      const newJackpot = await prisma.progressiveJackpot.create({
        data: {
          slug: req.params.slug,
          currentValue: 1000000n,
          minValue: 1000n,
        }
      });
      return res.json({ ...newJackpot, currentValue: newJackpot.currentValue.toString() });
    }
    
    res.json({ ...jackpot, currentValue: jackpot.currentValue.toString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
