import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Profile from './Profile';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';

// Mock axios
jest.mock('axios');

// Mock useNavigate
const mockedUsedNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedUsedNavigate,
}));

describe('Profile Component', () => {
  const mockUser = {
    _id: '1',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    email: 'john@example.com',
    mobile: '1234567890',
    address: '123 St',
    bio: 'Test bio',
    profilePicture: '',
    privacySettings: {
      profileVisibility: 'public',
      showEmail: false
    },
    followers: 10,
    following: 5,
    createdAt: '2023-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    localStorage.setItem('userInfo', JSON.stringify({ token: 'mockToken', firstName: 'John' }));
    axios.get.mockResolvedValue({ data: mockUser });
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders profile information correctly', async () => {
    render(
      <BrowserRouter>
        <Profile />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('@johndoe')).toBeInTheDocument();
      expect(screen.getByText('Test bio')).toBeInTheDocument();
    });
  });

  test('switches to edit mode when Edit Profile button is clicked', async () => {
    render(
      <BrowserRouter>
        <Profile />
      </BrowserRouter>
    );

    await waitFor(() => screen.getByText('Edit Profile'));
    
    fireEvent.click(screen.getByText('Edit Profile'));

    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('Save Profile')).toBeInTheDocument();
  });

  test('updates profile successfully', async () => {
    axios.put.mockResolvedValue({
      data: { ...mockUser, firstName: 'Jane', bio: 'New Bio' }
    });

    render(
      <BrowserRouter>
        <Profile />
      </BrowserRouter>
    );

    await waitFor(() => screen.getByText('Edit Profile'));
    fireEvent.click(screen.getByText('Edit Profile'));

    const firstNameInput = screen.getByPlaceholderText('First Name');
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

    const bioInput = screen.getByPlaceholderText('Write a short bio...');
    fireEvent.change(bioInput, { target: { value: 'New Bio' } });

    fireEvent.click(screen.getByText('Save Profile'));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        expect.objectContaining({ firstName: 'Jane', bio: 'New Bio' }),
        expect.any(Object)
      );
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('New Bio')).toBeInTheDocument();
    });
  });

  test('validates required fields', async () => {
    render(
      <BrowserRouter>
        <Profile />
      </BrowserRouter>
    );

    await waitFor(() => screen.getByText('Edit Profile'));
    fireEvent.click(screen.getByText('Edit Profile'));

    const firstNameInput = screen.getByPlaceholderText('First Name');
    fireEvent.change(firstNameInput, { target: { value: '' } });

    fireEvent.click(screen.getByText('Save Profile'));

    await waitFor(() => {
      expect(screen.getByText('First Name is required')).toBeInTheDocument();
    });
  });
});
