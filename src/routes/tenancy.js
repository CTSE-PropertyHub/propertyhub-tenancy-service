const { Router } = require('express');
const svc = require('../service');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    res.json(await svc.listTenancies(userId, userRole));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    res.json(await svc.getTenancy(req.params.id, userId, userRole));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    const tenancy = await svc.createTenancy(req.body, userId, userRole);
    res.status(201).json(tenancy);
  } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    res.json(await svc.updateStatus(req.params.id, req.body.status, userId, userRole));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    await svc.deleteTenancy(req.params.id, userId, userRole);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
