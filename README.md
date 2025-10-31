# Project Setup Guide for Senti

## Prerequisites
- Docker Desktop installed and running on your PC
- Git (for cloning the repository, if applicable)

## Repository Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Senti-fi/Senti.fi.git
   cd Senti.fi
   ```

## Quick Start

1. **Add Environment Files**
   - Create a `.env` file in the `backend` directory
   - Create a `.env` file in the `lucy-ai` directory

2. **Run the Application (Only for lucy AI and the Backend)**
   ```bash
   docker-compose up --build
   ```

3. **Run Database Migrations and Seeding**
   ```bash
   # Run database migrations
   docker-compose exec senti-backend npx prisma migrate dev

   # Seed the database with initial data
   docker-compose exec senti-backend npx prisma db seed
   ```

4. **Run the Frontend**
   ```bash
   # Navigate to frontend directory
   cd frontend

   # Install dependencies
   yarn install

   # Run development Server
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

## Project Structure
```
Senti.fi/
├── backend/
│   └── .env
├── frontend/
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

### Frontend (.env)
Add your frontend environment variables in `frontend/.env`:
```env
# Backend API
NEXT_PUBLIC_API_URL=
```

## Database Setup

After starting the containers, you need to set up the database:

1. **Run Migrations** - Creates the database schema
   ```bash
   docker-compose exec senti-backend npx prisma migrate dev
   ```

2. **Seed the Database** - Populates with initial data
   ```bash
   docker-compose exec senti-backend npx prisma db seed
   ```

**Note:** These commands should be run after the containers are up and running with `docker-compose up --build`.

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

5. **Database Connection Issues**
   - Ensure the database container is running
   - Verify DATABASE_URL in backend `.env` file is correct
   - Run migrations and seeding commands after containers are up

6. **Git Clone Issues**
   - Verify you have access to the repository
   - Check your internet connection
   - Ensure Git is properly installed

## Development

For development with hot-reload, check if your `docker-compose.yml` includes volume mounts for live code updates.

## Support

If you encounter issues:
1. Check Docker Desktop is running
2. Verify all `.env` files are properly configured
3. Ensure no port conflicts exist
4. Check the logs using `docker-compose logs`
5. Verify database migrations and seeding completed successfully
6. Ensure you have cloned the repository correctly