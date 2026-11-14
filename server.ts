import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, INITIAL_USERS } from './src/server/db';
import { FilterParams, User, UserRole, PaymentStatus } from './src/types/payment';
import { getDepositTargetStatus, STATUS_META } from './src/utils/workflowRules';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Helper pour extraire l'utilisateur courant de l'entête (ou repli sur l'admin ou agent)
  const getUserFromReq = (req: Request): User => {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as UserRole;
    const userName = req.headers['x-user-name'] as string;

    if (userId) {
      const existing = db.getUsers().find(u => u.id === userId);
      if (existing) {
        if (userRole) {
          return { ...existing, role: userRole };
        }
        return existing;
      }
    }

    return {
      id: userId || 'usr_agent1',
      name: (userName ? decodeURIComponent(userName) : '') || 'Monia Ben Salem',
      email: 'm.bensalem@mtk.tn',
      role: userRole || 'AGENT_FINANCIER',
      department: 'Direction Financière et Comptable',
    };
  };

  // --- API ENDPOINTS ---

  // 1. Utilisateurs
  app.get('/api/users', (_req: Request, res: Response) => {
    res.json(db.getUsers());
  });

  // 2. Fournisseurs
  app.get('/api/suppliers', (_req: Request, res: Response) => {
    res.json(db.getSuppliers());
  });

  app.post('/api/suppliers', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const supplier = db.createSupplier(req.body, user);
      res.status(201).json(supplier);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 3. Banques
  app.get('/api/banks', (_req: Request, res: Response) => {
    res.json(db.getBanks());
  });

  app.post('/api/banks', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const bank = db.createBank(req.body, user);
      res.status(201).json(bank);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/banks/:id', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const updated = db.updateBank(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 3b. Factures (Module 00)
  app.get('/api/invoices', (req: Request, res: Response) => {
    const isDemo =
      req.query.isDemo === 'true'
        ? true
        : req.query.isDemo === 'false'
        ? false
        : 'ALL';
    res.json(db.getInvoices({ isDemo }));
  });

  app.post('/api/invoices', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const invoice = db.createInvoice(req.body, user);
      res.status(201).json(invoice);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/invoices/:id', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      db.deleteInvoice(req.params.id, user);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 4. Ordres de paiement
  app.get('/api/orders', (req: Request, res: Response) => {
    const filters: FilterParams = {
      status: (req.query.status as any) || 'ALL',
      currency: (req.query.currency as any) || 'ALL',
      bank: (req.query.bank as any) || 'ALL',
      supplier: (req.query.supplier as any) || 'ALL',
      fiscalYear: req.query.fiscalYear ? (req.query.fiscalYear === 'ALL' ? 'ALL' : Number(req.query.fiscalYear)) : 'ALL',
      startDate: (req.query.startDate as string) || undefined,
      endDate: (req.query.endDate as string) || undefined,
      searchQuery: (req.query.searchQuery as string) || undefined,
      isDemo: req.query.isDemo === 'true' ? true : req.query.isDemo === 'false' ? false : 'ALL',
    };
    const orders = db.getOrders(filters);
    res.json(orders);
  });

  app.get('/api/orders/:id', (req: Request, res: Response) => {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Ordre de paiement introuvable' });
      return;
    }
    res.json(order);
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const newOrder = db.createOrder(req.body, user);
      res.status(201).json(newOrder);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/orders/:id', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const updated = db.updateOrder(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Changement de statut (Circuit de validation MTK)
  app.post('/api/orders/:id/status', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const { targetStatus, comment, depositData, executionData } = req.body;
      if (!targetStatus) {
        res.status(400).json({ error: 'Le paramètre targetStatus est obligatoire' });
        return;
      }
      const updated = db.changeOrderStatus(
        req.params.id,
        targetStatus as PaymentStatus,
        comment,
        user,
        depositData,
        executionData
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Enregistrement d'un dépôt bancaire (conditionnel selon négociation du cours exigée)
  app.post('/api/orders/:id/deposit', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const existing = db.getOrderById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Ordre de paiement introuvable' });
        return;
      }
      const { bankId, bankName, depositDate, slipNumber, bankReference, notes, depositReceiptDocId } = req.body;
      const targetStatus = getDepositTargetStatus(existing.requiresRateNegotiation);
      const updated = db.changeOrderStatus(
        req.params.id,
        targetStatus,
        notes ||
          (existing.requiresRateNegotiation
            ? `Dépôt bancaire effectué (Négociation exigée -> En attente d'achat devise) - Bordereau N° ${slipNumber}`
            : `Dépôt bancaire effectué - Bordereau N° ${slipNumber}`),
        user,
        {
          bankId,
          bankName,
          depositDate,
          slipNumber,
          bankReference,
          notes,
          depositReceiptDocId,
        }
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Enregistrement de l'exécution
  app.post('/api/orders/:id/execute', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const {
        executionDate,
        executingBank,
        executedAmount,
        finalExchangeRate,
        debitAmountTnd,
        accountDebitDate,
        swiftReference,
        bankFees,
      } = req.body;

      if (!swiftReference || !finalExchangeRate) {
        res.status(400).json({ error: 'La référence SWIFT et le cours de change final sont obligatoires pour exécuter l’ordre' });
        return;
      }

      const updated = db.changeOrderStatus(
        req.params.id,
        'EXECUTE',
        `Transfert international exécuté avec succès. Réf SWIFT: ${swiftReference}`,
        user,
        undefined,
        {
          executionDate,
          executingBank,
          executedAmount,
          finalExchangeRate: Number(finalExchangeRate),
          debitAmountTnd: Number(debitAmountTnd),
          accountDebitDate,
          swiftReference,
          bankFees: Number(bankFees) || 0,
        }
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Ajout de pièce justificative
  app.post('/api/orders/:id/documents', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const order = db.addDocumentToOrder(req.params.id, req.body, user);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. Statistiques du tableau de bord
  app.get('/api/stats', (req: Request, res: Response) => {
    const filters: FilterParams = {
      status: (req.query.status as any) || 'ALL',
      currency: (req.query.currency as any) || 'ALL',
      bank: (req.query.bank as any) || 'ALL',
      supplier: (req.query.supplier as any) || 'ALL',
      fiscalYear: req.query.fiscalYear ? (req.query.fiscalYear === 'ALL' ? 'ALL' : Number(req.query.fiscalYear)) : 'ALL',
      startDate: (req.query.startDate as string) || undefined,
      endDate: (req.query.endDate as string) || undefined,
      isDemo: req.query.isDemo === 'true' ? true : req.query.isDemo === 'false' ? false : 'ALL',
    };
    const stats = db.getDashboardStats(filters);
    res.json(stats);
  });

  // 6. Consultations d'achat de devises (Module 02)
  app.get('/api/consultations', (_req: Request, res: Response) => {
    res.json(db.getConsultations());
  });

  app.post('/api/consultations', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const consultation = db.createConsultation(req.body, user);
      res.status(201).json(consultation);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/consultations/:id/quotes', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const updated = db.recordConsultationQuotes(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/consultations/:id/cancel', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const updated = db.cancelConsultation(req.params.id, req.body?.reason || '', user);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7. Audit Logs
  app.get('/api/audit-logs', (_req: Request, res: Response) => {
    res.json(db.getAuditLogs());
  });

  // 8. Réinitialisation des données de démo
  app.post('/api/reset-demo', (_req: Request, res: Response) => {
    db.resetDemoData();
    res.json({ success: true, message: 'Données de démonstration réinitialisées avec succès' });
  });

  // 8. Export CSV
  app.get('/api/export-csv', (_req: Request, res: Response) => {
    const orders = db.getOrders();
    const headers = [
      'Numéro d’ordre',
      'Contrat',
      'Date de création',
      'Statut',
      'Négociation cours exigée',
      'Fournisseur / Bénéficiaire',
      'Pays',
      'Devise',
      'Montant Devise',
      'Banque Tunisienne',
      'Type Transfert',
      'Réf Facture',
      'Date Dépôt Banque',
      'N° Bordereau',
      'Réf SWIFT',
      'Taux Change',
      'Contre-valeur TND',
      'Est Démo',
    ];

    const rows = orders.map(o => [
      o.orderNumber,
      o.contractNumber || '',
      o.createdAt.split('T')[0],
      STATUS_META[o.status]?.label || o.status,
      o.requiresRateNegotiation ? 'OUI' : 'NON',
      `"${(o.beneficiaryName || '').replace(/"/g, '""')}"`,
      `"${(o.beneficiaryCountry || '').replace(/"/g, '""')}"`,
      o.currency,
      o.amount,
      `"${(o.bankName || '').replace(/"/g, '""')}"`,
      o.transferType || 'VIREMENT',
      o.invoiceNumber || '',
      o.deposit?.depositDate || '',
      o.deposit?.slipNumber || '',
      o.swiftReference || '',
      o.finalExchangeRate || '',
      o.debitAmountTnd || '',
      o.isDemo ? 'OUI' : 'NON',
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="MTK_Ordres_Paiement_International.csv"');
    res.send('\uFEFF' + csvContent); // BOM pour support parfait Excel
  });

  // Vite middleware in dev / Static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MTK International Payments Backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
