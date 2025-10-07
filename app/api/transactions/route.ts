import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/transactions
export async function GET() {
  try {
    const transactions = await prisma.managerTransaction.findMany({
      orderBy: {
        date: 'desc',
      },
      include: {
        customer: true,
      },
    });

    // Transform the data to match the frontend's expected format
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      date: tx.date.toISOString(),
      customerName: tx.customer.name,
      product: tx.product,
      capacity: tx.capacity || '',
      price: parseFloat(tx.price.toString()),
      quantity: tx.quantity,
      serial: tx.serial || '',
      isCollection: tx.isCollection,
      total: parseFloat(tx.total.toString()),
    }));

    return NextResponse.json(formattedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST /api/transactions
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { name: data.customerName },
    });
    
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: data.customerName,
          phone: '',
          address: '',
        },
      });
    }
    
    // Calculate total
    const total = data.price * data.quantity;
    
    // Create transaction
    const transaction = await prisma.managerTransaction.create({
      data: {
        date: new Date(data.date),
        product: data.product,
        capacity: data.capacity || null,
        price: data.price,
        quantity: data.quantity,
        serial: data.serial || null,
        isCollection: data.isCollection || false,
        total: total,
        customerId: customer.id,
      },
    });
    
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
