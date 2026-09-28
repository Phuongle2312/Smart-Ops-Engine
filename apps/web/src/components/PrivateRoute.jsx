import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const PrivateRoute = () => {
  const { accessToken } = useContext(AppContext);

  // Nếu chưa đăng nhập, chuyển hướng về trang login
  return accessToken ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
