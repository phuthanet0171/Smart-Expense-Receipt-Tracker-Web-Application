'use client';
import { use } from 'react';
import ExpenseForm from '@/components/expense-form';
export default function EditExpensePage({ params }: PageProps<'/expenses/[id]/edit'>) { const { id } = use(params); return <ExpenseForm expenseId={id}/>; }
