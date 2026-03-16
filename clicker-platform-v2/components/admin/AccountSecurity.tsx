'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, User, verifyBeforeUpdateEmail } from 'firebase/auth';
import { Lock, Mail, Key, AlertTriangle, CheckCircle } from 'lucide-react';
import { SubmitButton } from '@/components/admin/SubmitButton';

export function AccountSecurity() {
    const [user, setUser] = useState<User | null>(auth.currentUser);

    // Email Change State
    const [newEmail, setNewEmail] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailMessage, setEmailMessage] = useState({ type: '', text: '' });

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailLoading(true);
        setEmailMessage({ type: '', text: '' });

        if (!auth.currentUser || !auth.currentUser.email) {
            setEmailMessage({ type: 'error', text: 'User not authenticated.' });
            setEmailLoading(false);
            return;
        }

        try {
            // Re-authenticate
            const credential = EmailAuthProvider.credential(auth.currentUser.email, emailPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);

            // Verify Before Update Email
            await verifyBeforeUpdateEmail(auth.currentUser, newEmail);

            setEmailMessage({ type: 'success', text: 'Verification email sent. Please check your inbox to confirm.' });
            setNewEmail('');
            setEmailPassword('');
            setUser(auth.currentUser); // Refresh user
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                setEmailMessage({ type: 'error', text: 'Incorrect password.' });
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailMessage({ type: 'error', text: 'Email already in use.' });
            } else if (error.code === 'auth/requires-recent-login') {
                setEmailMessage({ type: 'error', text: 'Please log out and log in again.' });
            } else {
                setEmailMessage({ type: 'error', text: 'Failed to update email. ' + error.message });
            }
        } finally {
            setEmailLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordLoading(true);
        setPasswordMessage({ type: '', text: '' });

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
            setPasswordLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
            setPasswordLoading(false);
            return;
        }

        if (!auth.currentUser || !auth.currentUser.email) {
            setPasswordMessage({ type: 'error', text: 'User not authenticated.' });
            setPasswordLoading(false);
            return;
        }

        try {
            // Re-authenticate
            const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);

            // Update Password
            await updatePassword(auth.currentUser, newPassword);

            setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                setPasswordMessage({ type: 'error', text: 'Incorrect current password.' });
            } else if (error.code === 'auth/requires-recent-login') {
                setPasswordMessage({ type: 'error', text: 'Please log out and log in again.' });
            } else {
                setPasswordMessage({ type: 'error', text: 'Failed to update password. ' + error.message });
            }
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div className="mt-12 pt-12 border-t-2 border-dashed border-gray-200">
            <h2 className="text-2xl font-black text-brand-dark mb-8 uppercase flex items-center gap-3">
                <Lock className="text-brand-green fill-brand-green" /> Account Security
            </h2>

            <div className="space-y-8">
                {/* Change Email Section */}
                <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                        <Mail size={24} /> Change Email
                    </h3>

                    {emailMessage.text && (
                        <div className={`p-4 rounded-xl mb-6 font-bold flex items-center gap-2 ${emailMessage.type === 'error' ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'}`}>
                            {emailMessage.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                            {emailMessage.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdateEmail} className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-xl mb-4">
                            <p className="text-sm font-bold text-gray-500 uppercase mb-1">Current Email</p>
                            <p className="text-lg font-bold text-brand-dark">{auth.currentUser?.email}</p>
                        </div>

                        <div>
                            <label className="block text-brand-dark font-bold mb-2">New Email Address</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none font-medium transition-colors"
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-brand-dark font-bold mb-2">Current Password (Required)</label>
                            <input
                                type="password"
                                value={emailPassword}
                                onChange={(e) => setEmailPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none font-medium transition-colors"
                                placeholder="Confirm your password"
                                required
                            />
                        </div>

                        <SubmitButton
                            isLoading={emailLoading}
                            loadingLabel="Updating Email..."
                            label="Update Email"
                            className="w-full md:w-auto bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-colors"
                        />
                    </form>
                </div>

                {/* Change Password Section */}
                <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                        <Key size={24} /> Change Password
                    </h3>

                    {passwordMessage.text && (
                        <div className={`p-4 rounded-xl mb-6 font-bold flex items-center gap-2 ${passwordMessage.type === 'error' ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'}`}>
                            {passwordMessage.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                            {passwordMessage.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div>
                            <label className="block text-brand-dark font-bold mb-2">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none font-medium transition-colors"
                                placeholder="Enter current password"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-brand-dark font-bold mb-2">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none font-medium transition-colors"
                                placeholder="Enter new password (min. 6 chars)"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-brand-dark font-bold mb-2">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none font-medium transition-colors"
                                placeholder="Re-enter new password"
                                required
                            />
                        </div>

                        <SubmitButton
                            isLoading={passwordLoading}
                            loadingLabel="Updating Password..."
                            label="Update Password"
                            className="w-full md:w-auto bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-colors"
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}
