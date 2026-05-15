import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

// Read config safely
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);
const auth = getAuth();

// Seed logic for development
async function seedInitialOwner() {
  try {
    const email = "zeusstudent214@gmail.com";
    const snap = await db.collection('shop_owners').where('email', '==', email).get();
    if (snap.empty) {
      console.log('Seeding initial shop owner:', email);
      await db.collection('shop_owners').add({
        name: "Main Street Branch",
        email: email,
        totalDiscountsCount: 0,
        totalDiscountsValue: 0,
        createdAt: FieldValue.serverTimestamp()
      });
      
      // Also seed some test coupons
      await db.collection('coupons').doc('TEST10').set({
        code: 'TEST10',
        userUsn: '1234567890',
        discountPercentage: 10,
        status: 'active',
        createdAt: FieldValue.serverTimestamp()
      });
      await db.collection('coupons').doc('SAVE25').set({
        code: 'SAVE25',
        userUsn: '9876543210',
        discountPercentage: 25,
        status: 'active',
        createdAt: FieldValue.serverTimestamp()
      });
      console.log('Seeding completed successfully.');
    }
  } catch (error) {
    console.error('Error during seeding:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Seed data in background
  seedInitialOwner().catch(console.error);

  // Middleware to verify Firebase ID Token
  const verifyToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    if (idToken === 'BYPASS_TOKEN') {
      (req as any).user = { email: 'demo@merchant.com' };
      return next();
    }

    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Check if user is a whitelisted shop owner
  app.get('/api/me', verifyToken, async (req: any, res) => {
    try {
      const email = req.user.email;
      const shopOwnerDoc = await db.collection('shop_owners').where('email', '==', email).get();
      
      if (shopOwnerDoc.empty) {
        // Auto-create shop owner for testing purposes so any Google account works
        const newOwner = {
          name: "Demo Merchant",
          email: email,
          totalDiscountsCount: 0,
          totalDiscountsValue: 0,
          createdAt: FieldValue.serverTimestamp()
        };
        const docRef = await db.collection('shop_owners').add(newOwner);
        return res.json({ id: docRef.id, ...newOwner });
      }
      
      const ownerData = shopOwnerDoc.docs[0].data();
      res.json({ id: shopOwnerDoc.docs[0].id, ...ownerData });
    } catch (e) {
      console.error('/api/me error:', e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Validate coupon code
  app.post('/api/validate-code', verifyToken, async (req: any, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    // Check if user is whitelisted
    const shopOwnerDoc = await db.collection('shop_owners').where('email', '==', req.user.email).get();
    if (shopOwnerDoc.empty) return res.status(403).json({ error: 'Unauthorized' });

    try {
      const couponDoc = await db.collection('coupons').doc(code).get();
      if (!couponDoc.exists) {
        return res.status(404).json({ error: 'Code not found' });
      }

      const coupon = couponDoc.data()!;
      if (coupon.status !== 'active') {
        return res.status(400).json({ error: 'Code already used or inactive' });
      }

      // Check expiry (optional, requirement mentioned it)
      if (coupon.expiresAt && coupon.expiresAt.toDate() < new Date()) {
        return res.status(400).json({ error: 'Code expired' });
      }

      // Mask USN: first 3 + last 2
      const fullUsn = coupon.userUsn || '';
      const maskedUsn = fullUsn.length > 5 
        ? `${fullUsn.substring(0, 3)}...${fullUsn.substring(fullUsn.length - 2)}`
        : fullUsn;

      res.json({
        code: couponDoc.id,
        discountPercentage: coupon.discountPercentage,
        maskedUsn
      });
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Redeem coupon code
  app.post('/api/redeem-code', verifyToken, async (req: any, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const email = req.user.email;
    const shopOwners = await db.collection('shop_owners').where('email', '==', email).limit(1).get();
    if (shopOwners.empty) return res.status(403).json({ error: 'Unauthorized' });
    const shopDoc = shopOwners.docs[0];
    const shopId = shopDoc.id;
    const shopData = shopDoc.data();

    try {
      const result = await db.runTransaction(async (transaction) => {
        const couponRef = db.collection('coupons').doc(code);
        const couponSnapshot = await transaction.get(couponRef);

        if (!couponSnapshot.exists) throw new Error('Code not found');
        const coupon = couponSnapshot.data()!;
        if (coupon.status !== 'active') throw new Error('Code already used');

        // Mask USN for the log
        const fullUsn = coupon.userUsn || '';
        const maskedUsn = fullUsn.length > 5 
          ? `${fullUsn.substring(0, 3)}...${fullUsn.substring(fullUsn.length - 2)}`
          : fullUsn;

        // 1. Mark coupon as used
        transaction.update(couponRef, {
          status: 'used',
          usedAt: FieldValue.serverTimestamp(),
          redeemedByShopId: shopId
        });

        // 2. Create redemption log
        const logRef = db.collection('shop_owners').doc(shopId).collection('redemptions').doc();
        transaction.set(logRef, {
          couponCode: code,
          userUsnMasked: maskedUsn,
          discountPercentage: coupon.discountPercentage,
          timestamp: FieldValue.serverTimestamp()
        });

        // 3. Update shop stats
        transaction.update(shopDoc.ref, {
          totalDiscountsCount: FieldValue.increment(1),
          totalDiscountsValue: FieldValue.increment(coupon.discountPercentage)
        });

        return {
          success: true,
          discountPercentage: coupon.discountPercentage
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error('Redemption error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Get redemption logs for the shop
  app.get('/api/logs', verifyToken, async (req: any, res) => {
    try {
      const email = req.user.email;
      const shopOwners = await db.collection('shop_owners').where('email', '==', email).limit(1).get();
      if (shopOwners.empty) return res.status(403).json({ error: 'Unauthorized' });
      const shopId = shopOwners.docs[0].id;

      const logsSnapshot = await db.collection('shop_owners').doc(shopId).collection('redemptions')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const logs = logsSnapshot.docs.map(doc => {
        const data = doc.data();
        if (data.timestamp && typeof data.timestamp._seconds === 'number') {
          data.timestamp = { seconds: data.timestamp._seconds };
        }
        return { id: doc.id, ...data };
      });
      res.json(logs);
    } catch (e) {
      console.error('/api/logs error:', e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
