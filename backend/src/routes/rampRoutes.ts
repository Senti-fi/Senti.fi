import { Router } from 'express';
import { onRamp, offRamp, providerWebhook } from '../controllers/rampController';

const router = Router();

router.post('/onramp', onRamp);
router.post('/offramp', offRamp);
router.post('/webhook/provider', providerWebhook);

export default router;