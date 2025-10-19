'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPassword: '', confirm: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const troopOptions = ['Infantry', 'Rider', 'Ranged', 'Garrison', 'Mixed'];

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        setProfile({});
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (error) {
        console.error('Error fetching profile:', error.message);
        setProfile({});
      } else {
        const mapped = {
          player_name: data.player_name || '',
          full_name: data.full_name || '',
          country: data.country || '',
          discord_id: data.discord_id || '',
          igg_id: data.igg_id || '',
          email: data.email || '',
          troop_specialist: data.troop_specialist || '',
          has_farm: data.has_farm || false,
          rank_id: data.rank_id || null,
          hero_name: data.hero_name || '',
          might: data.might || 0,
          bio: data.bio || '',
          profile_image_url: data.profile_image_url || ''
        };
        setProfile(mapped);
        if (data.profile_image_url) setAvatarUrl(data.profile_image_url);
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  if (loading) return <p className="mt-20 text-center text-white">Loading profile...</p>;
  if (!profile) return <p className="mt-20 text-center text-white">Profile not found.</p>;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile({ ...profile, [name]: type === 'checkbox' ? checked : value });
  };

  const saveProfile = async (updatedFields = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return;

    const { error } = await supabase
      .from('players')
      .upsert(
        { ...profile, ...updatedFields, email },
        { onConflict: ['email'] }
      );

    if (error) {
      alert('Error saving profile: ' + error.message);
    } else {
      alert('Profile updated successfully!');
      setProfile(prev => ({ ...prev, ...updatedFields }));
    }
  };

  const handleSave = () => saveProfile();

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({ ...passwordForm, [name]: value });
  };

  const handlePasswordSave = async () => {
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setPasswordMessage('New password and confirmation do not match.');
      return;
    }

    const { data, error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword
    });

    if (error) {
      setPasswordMessage('Error updating password: ' + error.message);
    } else {
      setPasswordMessage('Password updated successfully!');
      setPasswordForm({ current: '', newPassword: '', confirm: '' });
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.email}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert('Error uploading image: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    setAvatarUrl(data.publicUrl);
    await saveProfile({ profile_image_url: data.publicUrl });

    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 py-10 px-4 text-white">
      <div className="max-w-lg mx-auto backdrop-blur-md bg-black/40 p-6 rounded-2xl shadow-2xl border border-white/20 space-y-6">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          My Profile
        </h2>

        {/* Avatar */}
        <div className="flex flex-col items-center space-y-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-32 h-32 rounded-full object-cover border border-gray-600 shadow-md"/>
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleAvatarUpload} id="avatarUpload" className="hidden" />
          <label htmlFor="avatarUpload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded shadow transition-colors">
            {uploading ? 'Uploading...' : 'Change Avatar'}
          </label>
        </div>

        {/* Profile Info */}
        <div className="flex flex-col gap-3">
          <input name="player_name" placeholder="Player Name" value={profile.player_name} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-blue-500"/>
          <input name="full_name" placeholder="Full Name" value={profile.full_name} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-blue-500"/>
          <input name="country" placeholder="Country" value={profile.country} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-blue-500"/>
          <input name="discord_id" placeholder="Discord ID" value={profile.discord_id} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-blue-500"/>
          <input name="igg_id" placeholder="IGG ID" value={profile.igg_id} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-blue-500"/>
          <input name="email" placeholder="Email" value={profile.email} disabled className="p-3 rounded-lg bg-gray-700 border border-gray-600 text-gray-400"/>
          <select name="troop_specialist" value={profile.troop_specialist} onChange={handleChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-blue-500">
            <option value="">Select Troop Type</option>
            {troopOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="has_farm" checked={profile.has_farm} onChange={handleChange} className="accent-blue-500"/>
            Has Farm Account
          </label>
          <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold shadow-md transition-all">Save Profile</button>
        </div>

        {/* Change Password */}
        <div className="bg-black/30 border border-gray-700 p-4 rounded-xl space-y-3 shadow-inner">
          <h3 className="text-xl font-semibold text-purple-400">Change Password</h3>
          <input type="password" name="current" placeholder="Current Password (optional)" value={passwordForm.current} onChange={handlePasswordChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500"/>
          <input type="password" name="newPassword" placeholder="New Password" value={passwordForm.newPassword} onChange={handlePasswordChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500"/>
          <input type="password" name="confirm" placeholder="Confirm New Password" value={passwordForm.confirm} onChange={handlePasswordChange} className="p-3 rounded-lg bg-gray-800/70 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500"/>
          <button onClick={handlePasswordSave} className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold shadow-md w-full transition-all">Update Password</button>
          {passwordMessage && <p className="text-sm text-red-500">{passwordMessage}</p>}
        </div>
      </div>
    </div>
  );
          }
