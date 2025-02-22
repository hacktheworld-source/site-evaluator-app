import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export interface UserData {
    balance: number;
    isPayAsYouGo: boolean;
    stripeCustomerId?: string;
    hasAddedPayment: boolean;
}

export interface PaymentHistory {
    id: string;
    amount: number;
    status: string;
    created: Date;
    receipt_url?: string;
}

class PaymentService {
    async getUserData(userId: string): Promise<UserData> {
        const response = await axios.get(`${API_URL}/api/users/${userId}`);
        return response.data;
    }

    async createSetupSession(userId: string): Promise<string> {
        const response = await axios.post(`${API_URL}/api/payment/setup-session`, {
            userId
        });
        return response.data.url;
    }

    async getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
        const response = await axios.get(`${API_URL}/api/payment/history/${userId}`);
        return response.data.map((payment: any) => ({
            ...payment,
            created: new Date(payment.created)
        }));
    }

    async checkPaymentMethodStatus(userId: string): Promise<boolean> {
        const response = await axios.get(`${API_URL}/api/payment/payment-status/${userId}`);
        return response.data.hasPaymentMethod;
    }

    async unenrollFromPayAsYouGo(userId: string): Promise<void> {
        await axios.post(`${API_URL}/api/payment/unenroll`, {
            userId
        });
    }

    async createPaymentIntent(userId: string, amount: number) {
        const response = await axios.post(`${API_URL}/api/payment/intent`, {
            userId,
            amount
        });
        return response.data;
    }
}

export const paymentService = new PaymentService(); 