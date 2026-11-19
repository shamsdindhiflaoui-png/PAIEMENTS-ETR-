import express, { Request, Response } from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { repository } from './src/db/repository.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { FilterParams, User, UserRole, PaymentStatus } from './src/types/payment.ts';
import { getDepositTargetStatus, STATUS_META } from './src/utils/workflowRules.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Sécurisation obligatoire de toutes les routes API via Firebase Auth
  app.use('/api', requireAuth);

  // Helper pour extraire l'utilisateur courant de l'entête
  const getUserFromReq = async (req: AuthRequest): Promise<User> => {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as UserRole;
    const userName = req.headers['x-user-name'] as string;

    if (userId) {
      const allUsers = await repository.getUsers();
      const existing = allUsers.find(u => u.id === userId);
      if (existing) {
        if (userRole) {
          return { ...existing, role: userRole };
        }
        return existing;
      }
    }

    return {
      id: userId || 'usr_agent1',
      userCode: '001',
      name:
        (userName ? decodeURIComponent(userName) : '') ||
        (typeof req.user?.name === 'string' ? req.user.name : '') ||
        'Monia Ben Salem',
      email: req.user?.email || 'm.bensalem@mtk.tn',
      role: userRole || 'AGENT_FINANCIER',
      department: 'Direction Financière et Comptable',
    };
  };

  const handleError = (res: Response, err: any, defaultStatus = 400) => {
    const statusCode =
      err?.name === 'ForbiddenError'
        ? 403
        : err?.name === 'DomainError'
        ? 400
        : err?.cause
        ? 500
        : defaultStatus;
    res.status(statusCode).json({ error: err?.message || 'Erreur serveur' });
  };

  // --- API ENDPOINTS (PostgreSQL Cloud SQL + Drizzle) ---

  // 0. Bootstrap agrégé (1 seule requête au démarrage, sans auditLogs ni dataBase64)
  app.get('/api/bootstrap', async (req: Request, res: Response) => {
    try {
      const isDemo =
        req.query.isDemo === 'true'
          ? true
          : req.query.isDemo === 'false'
          ? false
          : 'ALL';
      res.json(await repository.getBootstrapData(isDemo));
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  // 1. Utilisateurs / Profils DFC
  app.get('/api/users', async (_req: Request, res: Response) => {
    try {
      res.json(await repository.getUsers());
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  // 2. Fournisseurs
  app.get('/api/suppliers', async (_req: Request, res: Response) => {
    try {
      res.json(await repository.getSuppliers());
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  app.post('/api/suppliers', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const supplier = await repository.createSupplier(req.body, user);
      res.status(201).json(supplier);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  // 3. Banques
  app.get('/api/banks', async (_req: Request, res: Response) => {
    try {
      res.json(await repository.getBanks());
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  app.post('/api/banks', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const bank = await repository.createBank(req.body, user);
      res.status(201).json(bank);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.put('/api/banks/:id', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const updated = await repository.updateBank(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  // 3b. Factures (Module 00)
  app.get('/api/invoices', async (req: Request, res: Response) => {
    try {
      const isDemo =
        req.query.isDemo === 'true'
          ? true
          : req.query.isDemo === 'false'
          ? false
          : 'ALL';
      res.json(await repository.getInvoices({ isDemo }));
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  app.post('/api/invoices', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const invoice = await repository.createInvoice(req.body, user);
      res.status(201).json(invoice);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.put('/api/invoices/:id', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const updated = await repository.updateInvoice(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.post('/api/invoices/:id/definitive', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const updated = await repository.attachDefinitiveInvoice(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.get('/api/invoices/:id/documents/:docId', async (req: Request, res: Response) => {
    try {
      const doc = await repository.getInvoiceDocument(req.params.id, req.params.docId);
      if (!doc) {
        res.status(404).json({ error: 'Pièce jointe introuvable' });
        return;
      }
      res.json(doc);
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  app.delete('/api/invoices/:id', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      await repository.deleteInvoice(req.params.id, user);
      res.json({ success: true });
    } catch (err: any) {
      handleError(res, err);
    }
  });

  // 4. Ordres de paiement
  app.get('/api/orders', async (req: Request, res: Response) => {
    try {
      const filters: FilterParams = {
        status: (req.query.status as any) || 'ALL',
        currency: (req.query.currency as any) || 'ALL',
        bank: (req.query.bank as any) || 'ALL',
        supplier: (req.query.supplier as any) || 'ALL',
        fiscalYear: req.query.fiscalYear
          ? req.query.fiscalYear === 'ALL'
            ? 'ALL'
            : Number(req.query.fiscalYear)
          : 'ALL',
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
        searchQuery: (req.query.searchQuery as string) || undefined,
        isDemo:
          req.query.isDemo === 'true'
            ? true
            : req.query.isDemo === 'false'
            ? false
            : 'ALL',
      };
      const orders = await repository.getOrders(filters);
      res.json(orders);
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  app.get('/api/orders/next-number', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const fiscalYear = req.query.fiscalYear
        ? Number(req.query.fiscalYear)
        : new Date().getFullYear();
      res.json(
        await repository.previewNextOrderNumber(
          user,
          Number.isFinite(fiscalYear) ? fiscalYear : undefined
        )
      );
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  app.get('/api/orders/:id', async (req: Request, res: Response) => {
    try {
      const order = await repository.getOrderById(req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Ordre de paiement introuvable' });
        return;
      }
      res.json(order);
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  app.post('/api/orders', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const newOrder = await repository.createOrder(req.body, user);
      res.status(201).json(newOrder);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.put('/api/orders/:id', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const updated = await repository.updateOrder(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.put('/api/orders/:id/deductions', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const updated = await repository.updateOrderDeductions(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.delete('/api/orders/:id', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      await repository.deleteOrder(req.params.id, user);
      res.json({ success: true });
    } catch (err: any) {
      handleError(res, err);
    }
  });

  // Changement de statut (Circuit de validation MTK)
  app.post('/api/orders/:id/status', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const { targetStatus, comment, depositData, executionData } = req.body;
      if (!targetStatus) {
        res.status(400).json({ error: 'Le paramètre targetStatus est obligatoire' });
        return;
      }
      const updated = await repository.changeOrderStatus(
        req.params.id,
        targetStatus as PaymentStatus,
        comment,
        user,
        depositData,
        executionData
      );
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  // Enregistrement d'un dépôt bancaire (conditionnel selon négociation du cours exigée)
  app.post('/api/orders/:id/deposit', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const existing = await repository.getOrderById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Ordre de paiement introuvable' });
        return;
      }
      const {
        bankId,
        bankName,
        depositDate,
        slipNumber,
        bankReference,
        notes,
        depositReceiptDocId,
      } = req.body;
      const targetStatus = getDepositTargetStatus(existing.requiresRateNegotiation);
      const updated = await repository.changeOrderStatus(
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
      handleError(res, err);
    }
  });

  // Enregistrement de l'exécution
  app.post('/api/orders/:id/execute', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
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
        res.status(400).json({
          error:
            'La référence SWIFT et le cours de change final sont obligatoires pour exécuter l’ordre',
        });
        return;
      }

      const updated = await repository.changeOrderStatus(
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
      handleError(res, err);
    }
  });

  // Ajout de pièce justificative
  app.post('/api/orders/:id/documents', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const order = await repository.addDocumentToOrder(req.params.id, req.body, user);
      res.json(order);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  // Téléchargement à la demande d'une pièce justificative d'ordre
  app.get('/api/orders/:id/documents/:docId', async (req: Request, res: Response) => {
    try {
      const doc = await repository.getOrderDocument(req.params.id, req.params.docId);
      if (!doc) {
        res.status(404).json({ error: 'Pièce justificative introuvable' });
        return;
      }
      res.json(doc);
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  // 5. Statistiques du tableau de bord
  app.get('/api/stats', async (req: Request, res: Response) => {
    try {
      const filters: FilterParams = {
        status: (req.query.status as any) || 'ALL',
        currency: (req.query.currency as any) || 'ALL',
        bank: (req.query.bank as any) || 'ALL',
        supplier: (req.query.supplier as any) || 'ALL',
        fiscalYear: req.query.fiscalYear
          ? req.query.fiscalYear === 'ALL'
            ? 'ALL'
            : Number(req.query.fiscalYear)
          : 'ALL',
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
        isDemo:
          req.query.isDemo === 'true'
            ? true
            : req.query.isDemo === 'false'
            ? false
            : 'ALL',
      };
      const stats = await repository.getDashboardStats(filters);
      res.json(stats);
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  // 6. Consultations d'achat de devises (Module 02)
  app.get('/api/consultations', async (_req: Request, res: Response) => {
    try {
      res.json(await repository.getConsultations());
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  app.post('/api/consultations', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const consultation = await repository.createConsultation(req.body, user);
      res.status(201).json(consultation);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.post('/api/consultations/:id/quotes', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const updated = await repository.recordConsultationQuotes(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.put('/api/consultations/:id', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const updated = await repository.updateConsultation(req.params.id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.delete('/api/consultations/:id', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      await repository.deleteConsultation(req.params.id, user);
      res.json({ success: true });
    } catch (err: any) {
      handleError(res, err);
    }
  });

  app.post('/api/consultations/:id/cancel', async (req: AuthRequest, res: Response) => {
    try {
      const user = await getUserFromReq(req);
      const updated = await repository.cancelConsultation(
        req.params.id,
        req.body?.reason || '',
        user
      );
      res.json(updated);
    } catch (err: any) {
      handleError(res, err);
    }
  });

  // 7. Audit Logs
  app.get('/api/audit-logs', async (_req: Request, res: Response) => {
    try {
      res.json(await repository.getAuditLogs());
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  // 8. Réinitialisation des données de démo
  app.post('/api/reset-demo', async (_req: Request, res: Response) => {
    try {
      await repository.resetDemoData();
      res.json({
        success: true,
        message: 'Données de démonstration réinitialisées avec succès',
      });
    } catch (err: any) {
      handleError(res, err, 500);
    }
  });

  // 8. Export CSV
  app.get('/api/export-csv', async (_req: Request, res: Response) => {
    try {
      const orders = await repository.getOrders();
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
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="MTK_Ordres_Paiement_International.csv"'
      );
      res.send('\uFEFF' + csvContent);
    } catch (err: any) {
      handleError(res, err, 500);
    }
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
