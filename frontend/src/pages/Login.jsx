import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import PlasmaBackground from '../components/PlasmaBackground';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors

        try {
            console.log('Attempting login...');
            const res = await axios.post('http://localhost:3000/api/auth/login', { email, password });

            if (!res.data || !res.data.token) {
                setError('Invalid response from server');
                return;
            }

            console.log('Login successful, setting localStorage...');
            // Set all items synchronously
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('role', res.data.role);
            localStorage.setItem('userId', res.data.userId.toString());
            localStorage.setItem('email', res.data.email);

            console.log('localStorage set, navigating to:', res.data.role);

            // Trigger custom event to notify ProtectedRoute
            window.dispatchEvent(new Event('localStorageUpdate'));

            // Navigate immediately - no delay needed
            const role = res.data.role;
            if (role === 'operator') {
                navigate('/operator', { replace: true });
            } else if (role === 'driver') {
                navigate('/driver', { replace: true });
            } else if (role === 'customer') {
                navigate('/customer', { replace: true });
            } else {
                setError('Unknown role received');
            }
        } catch (err) {
            console.error('Login error:', err);
            if (err.response) {
                // Server responded with a status code
                const errorMsg = err.response.data?.error || 'Invalid credentials';
                setError(errorMsg);
                console.error('Server error:', err.response.status, errorMsg);
            } else if (err.request) {
                // Request made but no response
                setError('Cannot connect to server. Ensure backend is running on http://localhost:3000');
                console.error('Network error:', err.request);
            } else {
                setError('Login failed. Please try again.');
                console.error('Error:', err.message);
            }
        }
    };

    return (
        <div className="relative flex items-center justify-center h-screen bg-black overflow-hidden">
            <div className="absolute inset-0 z-0">
                <PlasmaBackground
                    color="#5227FF"
                    mouseInteractive={true}
                />
            </div>
            <div className="relative z-10">
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-80">
                    <h2 className="text-xl font-bold mb-4">Login</h2>
                    {error && <p className="text-red-500 mb-2">{error}</p>}
                    <input
                        className="border p-2 w-full mb-2"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        className="border p-2 w-full mb-4"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit" className="bg-blue-500 text-white p-2 w-full rounded hover:bg-blue-600">Login</button>
                    <p className="mt-2 text-sm">
                        Don't have an account? <Link to="/register" className="text-blue-500 hover:underline">Register</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Login;
