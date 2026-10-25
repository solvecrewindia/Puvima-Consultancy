/**
 * Vercel Serverless Function Handler for Backend
 * Mounts the Express application when Root Directory is set to "backend"
 */
const express = require('express');
const app = require('../src/app');

module.exports = app;
