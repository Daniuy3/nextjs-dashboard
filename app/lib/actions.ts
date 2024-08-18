"use server";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {z} from "zod";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }

  
export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };

const formSchema = z.object({
    id: z.string({
        invalid_type_error: "Please select a customer"
    }),
    customerId: z.string(),
    amount: z.coerce.number()
                        .gt(0, {message: "Amount must be greater than $0"}),
    status: z.enum(['paid', 'pending'],{
        invalid_type_error: "Please select an invoice status"
    }),
    date: z.string()
});

const CreateInvoice = formSchema.omit({date: true, id: true});
const UpdateInvoice = formSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State,formData: FormData){

    const validatedData = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if(!validatedData.success){
        return {
            errors: validatedData.error.flatten().fieldErrors,
            message: 'Missing Fields: Failed to Create Invoice'
        };
    }

    const {customerId, amount, status} = validatedData.data
    
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try{
        await sql `
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    }
    catch(err){        
        return{
            message: 'Database Error: Failed to Create Invoice'
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedData = UpdateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    if(!validatedData.success){
        return {
            errors: validatedData.error.flatten().fieldErrors,
            message: 'Missing Fields: Failed to Update Invoice'
        };
    }

    const {customerId, amount, status} = validatedData.data;
    const amountInCents = amount * 100;
   
    try{
        await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
    } catch (err) {
        return { message: 'Database Error: Failed to Update Invoice '
        };
    }
   
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  }

  export async function deleteInvoice(id: string) {
    
    try{
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: "Deleted Invoice"}
    }
    catch(err){
        return { message: "Database Error: Failed to Delete Invoice"}
    }
    
  }