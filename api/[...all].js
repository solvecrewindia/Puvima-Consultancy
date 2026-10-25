/**
 * Vercel Serverless Function Catch-All Entrypoint
 * Catches all /api/* routes natively in Vercel's file-system router.
 */
const express = require('express');
const app = require('../backend/src/app');

module.exports = app;
