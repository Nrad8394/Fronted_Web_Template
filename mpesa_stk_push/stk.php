<?php

class MpesaSTKPush
{
    private $mpesa_url;
    private $mpesa_access_token;
    private $mpesa_passkey;
    private $mpesa_shortcode;

    public function __construct($mpesa_access_token, $mpesa_passkey, $mpesa_shortcode, $mpesa_url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest')
    {
        $this->mpesa_access_token = $mpesa_access_token;
        $this->mpesa_passkey = $mpesa_passkey;
        $this->mpesa_shortcode = $mpesa_shortcode;
        $this->mpesa_url = $mpesa_url;
    }

    public function stkPush($phone_number, $amount, $account_reference, $transaction_desc, $callback_url)
    {
        if (empty($account_reference)) {
            throw new Exception('Account reference cannot be blank');
        }
        if (empty($transaction_desc)) {
            throw new Exception('Transaction description cannot be blank');
        }
        if (!is_int($amount)) {
            throw new Exception('Amount must be an integer');
        }

        // Format phone number (if needed)
        $phone_number = $this->formatPhoneNumber($phone_number);

        $timestamp = date('YmdHis');
        $password = base64_encode($this->mpesa_shortcode . $this->mpesa_passkey . $timestamp);
        $transaction_type = 'CustomerPayBillOnline';
        $party_a = $phone_number;
        $party_b = $this->mpesa_shortcode;

        $data = [
            'BusinessShortCode' => $this->mpesa_shortcode,
            'Password' => $password,
            'Timestamp' => $timestamp,
            'TransactionType' => $transaction_type,
            'Amount' => $amount,
            'PartyA' => $party_a,
            'PartyB' => $party_b,
            'PhoneNumber' => $phone_number,
            'CallBackURL' => $callback_url,
            'AccountReference' => $account_reference,
            'TransactionDesc' => $transaction_desc
        ];

        $headers = [
            'Authorization' => 'Bearer ' . $this->mpesa_access_token,
            'Content-Type' => 'application/json'
        ];

        return $this->sendRequest($data, $headers);
    }

    private function formatPhoneNumber($phone_number)
    {
        // Make sure phone number is in the correct format.
        // If the phone number isn't already in the correct format, you can handle that here.
        return $phone_number;
    }

    private function sendRequest($data, $headers)
    {
        $ch = curl_init($this->mpesa_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch);

        if ($response === false) {
            throw new Exception('Curl Error: ' . curl_error($ch));
        }

        curl_close($ch);

        return json_decode($response, true);
    }
}

// Example usage
try {
    $mpesa_access_token = 'your_access_token';
    $mpesa_passkey = '649cad400dfcd701c0c3b40a6b4acdd661c0083c89cd57a160c44709a3dc91ba';
    $mpesa_shortcode = '7123052';
    $callback_url = 'https://yourcallbackurl.com/callback';

    $stkPush = new MpesaSTKPush($mpesa_access_token, $mpesa_passkey, $mpesa_shortcode);
    $response = $stkPush->stkPush('254716549814', 1, 'TestAccount123', 'Payment for goods', $callback_url);
    print_r($response); // Output the response from M-Pesa

} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage();
}

?>
