// happy-colors-nextjs-project/src/components/ui/MessageBox.jsx

'use client';
import React from 'react';
import styles from './MessageBox.module.css';

export default function MessageBox({ type = 'error', message }) {
    const typeClass = type === 'success' ? styles.success : type === 'info' ? styles.info : styles.error;
    const boxClass = `${styles.message} ${typeClass}`;

   

    return <div className={boxClass}>{message}</div>;
}
