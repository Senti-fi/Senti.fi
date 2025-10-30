# Project Setup Guide for Senti

## Prerequisites
- Docker Desktop installed and running on your PC
- Git (for cloning the repository, if applicable)

## Quick Start

1. **Add Environment Files**
   - Create a `.env` file in the `backend` directory
   - Create a `.env` file in the `lucy-ai` directory

2. **Run the Application**
   ```bash
   docker-compose up --build
   ```

## Project Structure
```
project-root/
├── backend/
│   └── .env
├── lucy-ai/
│   └── .env
└── docker-compose.yml
```

## Environment Configuration

### Backend (.env)
Add your backend environment variables in `backend/.env`:
```env
# Example variables - adjust according to your needs
DATABASE_URL=your_database_url
SECRET_KEY=your_secret_key
API_PORT=3000
```

### Lucy AI (.env)
Add your Lucy AI environment variables in `lucy-ai/.env`:
```env
# Example variables - adjust according to your needs
AI_API_KEY=your_ai_api_key
MODEL_NAME=your_model_name
```
## Troubleshooting

1. **Docker Desktop Not Running**
   - Ensure Docker Desktop is installed and running
   - Verify Docker daemon is active

2. **Port Conflicts**
   - Check if required ports are available
   - Modify ports in `docker-compose.yml` if needed

3. **Environment Files Missing**
   - Ensure both `.env` files exist in their respective directories
   - Verify file names are exactly `.env` (not `.env.txt` or similar)

4. **Build Issues**
   - Clear Docker cache: `docker system prune -a`
   - Restart Docker Desktop

## Development

For development with hot-reload, check if your `docker-compose.yml` includes volume mounts for live code updates.

## Support

If you encounter issues:
1. Check Docker Desktop is running
2. Verify all `.env` files are properly configured
3. Ensure no port conflicts exist
4. Check the logs using `docker-compose logs`

