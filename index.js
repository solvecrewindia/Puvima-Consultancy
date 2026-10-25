/**
 * PUVIMA Consultancy — Application Root Entrypoint for Vercel
 * Mounts the Express application for serverless invocation on Vercel.
 */
const express = require('express');
const app = require('./backend/src/app');

module.exports = app;
