# Frontend Web Template

A comprehensive full-stack web application template featuring Next.js frontend with authentication system and M-Pesa payment integration.

## 🚀 Features

### Frontend (Next.js Template)
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Dark/Light theme** support
- **Authentication system** with multiple pages:
  - Login/Register
  - Password Reset
  - Profile Management
  - Logout functionality
- **Responsive design** with modern UI components
- **Axios** for API requests
- **Context providers** for state management

### Backend Integration
- **M-Pesa STK Push** implementation (PHP)
- API configuration and management
- Authentication middleware

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PHP** (for M-Pesa integration)
- **Git**

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/Fronted_Web_Template.git
cd Fronted_Web_Template
```

### 2. Setup Next.js Frontend
```bash
cd next_template
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the `next_template` directory:
```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=Your App Name

# Authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# M-Pesa Configuration (if using)
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_SHORTCODE=your-shortcode
MPESA_PASSKEY=your-passkey
```

## 🚀 Getting Started

### Development Server
```bash
cd next_template
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production
```bash
npm run build
npm start
```

## 📁 Project Structure

```
Frontend_Web_Template/
├── next_template/                 # Next.js application
│   ├── app/                      # App router pages
│   │   ├── (auth)/              # Authentication pages
│   │   │   ├── Login/
│   │   │   ├── Register/
│   │   │   ├── Profile/
│   │   │   └── ...
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Home page
│   ├── components/              # Reusable components
│   ├── contexts/                # React contexts
│   │   ├── AuthContext.tsx
│   │   └── theme-context.tsx
│   ├── handler/                 # API handlers
│   │   ├── ApiConfig.tsx
│   │   ├── AuthManager.tsx
│   │   └── axiosInstance.ts
│   └── types/                   # TypeScript types
├── mpesa_stk_push/              # M-Pesa integration
│   └── stk.php                  # STK Push implementation
└── README.md
```

## 🎨 Customization

### Theme Configuration
The template includes a theme context that supports light/dark modes. Customize colors in:
- `tailwind.config.ts` - Tailwind theme configuration
- `app/globals.css` - Global styles
- `contexts/theme-context.tsx` - Theme logic

### Authentication Flow
Modify authentication pages in `app/(auth)/` directory:
- Login page: `app/(auth)/Login/page.tsx`
- Registration: `app/(auth)/Register/page.tsx`
- Profile: `app/(auth)/Profile/page.tsx`

### API Integration
Configure API endpoints in:
- `handler/ApiConfig.tsx` - API configuration
- `handler/axiosInstance.ts` - Axios setup
- `handler/AuthManager.tsx` - Authentication logic

## 💳 M-Pesa Integration

The template includes M-Pesa STK Push functionality:

### PHP Implementation
```php
// Basic usage
$mpesa = new MpesaSTKPush($access_token, $passkey, $shortcode);
$response = $mpesa->stkPush($phone, $amount, $reference, $description, $callback_url);
```

### Configuration
1. Get M-Pesa API credentials from Safaricom Developer Portal
2. Update the credentials in your environment variables
3. Configure callback URLs for payment processing

## 🧪 Available Scripts

In the `next_template` directory:

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 📦 Dependencies

### Main Dependencies
- **Next.js 15.1.5** - React framework
- **React 19** - UI library
- **Axios 1.7.9** - HTTP client
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety

### Development Dependencies
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Various TypeScript types**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or need help:
1. Check the [Issues](https://github.com/your-username/Fronted_Web_Template/issues) page
2. Create a new issue with detailed information
3. Join our community discussions

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Tailwind CSS for the utility-first approach
- Safaricom for M-Pesa API documentation
- Open source community for inspiration

---

**Happy coding!** 🎉