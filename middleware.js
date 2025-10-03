// middleware.js
import express from "express";
import cors from "cors";
import * as Errors from "./utils/error-util.js";
import * as Response from "./utils/http-response-util.js";
import { verifyJWT } from "./services/auth-service/service.js";
import cookieParser from "cookie-parser";

export function registerBeforeAllMiddleware(app) {
  app.use(cors({origin: true, credentials: true}));
  app.use(express.static("public"));
  app.use(cookieParser());
  app.use(express.json());
  app.use((req, res, next) => {
    req.body = req.body ? req.body : {};
    next();
  });

  app.use(getUser);
}

export function registerAfterAllMiddleware(app) {
  app.use(errorHandler);
}

export function getUser(req, res, next) {
  let user = null;
      
  let jwt = req.cookies?.jwt;
  try {
    if (jwt) user = verifyJWT(jwt);
  }
  catch (err) {
    user = null;
  }

  req.user = user;
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) {
    throw new Errors.NotAuthenticatedError();
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) throw new Errors.NotAuthenticatedError();
  if (!req.user.isAdmin) throw new Errors.NotAllowedError();
  next();
}

export function errorHandler(err, req, res, next) {
  const isAppError = err instanceof Errors.AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errMessage = isAppError ? err.message : "Sorry, an unknown error occured";
  Response.sendError(errMessage, statusCode, { req, res });
  const NODE_ENV = process.env.NODE_ENV;
  if (["debug", "debug-mongoose", "production"].includes(NODE_ENV)) {
    console.error("=== ", err);
  }
}
