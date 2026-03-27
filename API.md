# API Documentation

This document provides a comprehensive overview of all available API endpoints in the application.

## Authentication Endpoints

Base URL: `/auth`

### Login
- **Endpoint:** `POST /auth/login`
- **Description:** Authenticates a user and returns access and refresh tokens
- **Request Body:**
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "accessToken": "string",
    "refreshToken": "string"
  }
  ```

### Register
- **Endpoint:** `POST /auth/register`
- **Description:** Creates a new user account and returns access and refresh tokens
- **Request Body:**
  ```json
  {
    "email": "string",
    "password": "string",
    "name": "string"
  }
  ```
- **Response:** `201 Created`
  ```json
  {
    "accessToken": "string",
    "refreshToken": "string"
  }
  ```

### Refresh Token
- **Endpoint:** `POST /auth/refresh`
- **Description:** Generates new access and refresh tokens using a valid refresh token
- **Request Body:**
  ```json
  {
    "refreshToken": "string"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "accessToken": "string",
    "refreshToken": "string"
  }
  ```

### Get Current User
- **Endpoint:** `GET /auth/me`
- **Description:** Returns the currently authenticated user's information
- **Authentication:** Required (Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "id": "string",
    "email": "string",
    "name": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```

## Health Check Endpoints

Base URL: `/health`

### System Health Check
- **Endpoint:** `GET /health`
- **Description:** Performs a comprehensive health check of the system, including:
  - Redis connection status
  - Memory heap usage (alerts if above 200MB)
  - Disk storage usage (alerts if above 90%)
- **Response:** `200 OK`
  ```json
  {
    "status": "ok",
    "info": {
      "redis": { "status": "up" },
      "memory_heap": { "status": "up" },
      "disk": { "status": "up" }
    }
  }
  ```

## Queue Status Endpoints

Base URL: `/queue-status`

### Get All Jobs
- **Endpoint:** `GET /queue-status`
- **Description:** Returns the status of all jobs in the queue
- **Response:** `200 OK`
  ```json
  [
    {
      "jobId": "string",
      "status": "string",
      "progress": "number",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
  ```

### Get Job Status
- **Endpoint:** `GET /queue-status/:jobId`
- **Description:** Returns the status of a specific job by its ID
- **Parameters:**
  - `jobId` (path parameter): The unique identifier of the job
- **Response:** `200 OK`
  ```json
  {
    "jobId": "string",
    "status": "string",
    "progress": "number",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **Error Response:** `404 Not Found`
  ```json
  {
    "statusCode": 404,
    "message": "Job with ID {jobId} not found"
  }
  ```

## Authentication

Most endpoints require authentication using a Bearer token. To authenticate:

1. Include the `Authorization` header in your requests:
   ```
   Authorization: Bearer <your_access_token>
   ```
2. The access token can be obtained through the login or register endpoints
3. When the access token expires, use the refresh token endpoint to obtain a new pair of tokens

## Error Responses

The API uses standard HTTP status codes to indicate the success or failure of requests:

- `200 OK`: The request was successful
- `201 Created`: The resource was successfully created
- `400 Bad Request`: The request was invalid
- `401 Unauthorized`: Authentication is required or failed
- `403 Forbidden`: The authenticated user doesn't have permission
- `404 Not Found`: The requested resource was not found
- `500 Internal Server Error`: An unexpected error occurred

Error responses typically include a message explaining what went wrong:

```json
{
  "statusCode": number,
  "message": "string",
  "error": "string"
}
``` 