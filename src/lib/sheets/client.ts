// src/lib/sheets/client.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

/**
 * Google Sheets client for bidirectional sync
 * 
 * Authentication uses service account credentials from env vars:
 * - GOOGLE_SHEETS_CLIENT_EMAIL
 * - GOOGLE_SHEETS_PRIVATE_KEY
 * - GOOGLE_SHEETS_SPREADSHEET_ID
 */

export interface SheetData {
  range: string;
  values: any[][];
}

class SheetsClient {
  private sheets: any;
  private auth: JWT;
  private spreadsheetId: string;

  constructor() {
    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      throw new Error('Missing GOOGLE_SHEETS_CLIENT_EMAIL environment variable');
    }
    if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      throw new Error('Missing GOOGLE_SHEETS_PRIVATE_KEY environment variable');
    }
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      throw new Error('Missing GOOGLE_SHEETS_SPREADSHEET_ID environment variable');
    }

    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    // Create JWT auth client
    this.auth = new google.auth.JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Initialize sheets API
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Read data from a sheet range
   */
  async readRange(range: string): Promise<any[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      return response.data.values || [];
    } catch (error: any) {
      throw new Error(`Failed to read sheet range ${range}: ${error.message}`);
    }
  }

  /**
   * Write data to a sheet range (overwrites existing data)
   */
  async writeRange(range: string, values: any[][]): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to write sheet range ${range}: ${error.message}`);
    }
  }

  /**
   * Clear a sheet range
   */
  async clearRange(range: string): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range,
      });
    } catch (error: any) {
      throw new Error(`Failed to clear sheet range ${range}: ${error.message}`);
    }
  }

  /**
   * Append rows to the end of a sheet
   */
  async appendRows(range: string, values: any[][]): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to append rows to ${range}: ${error.message}`);
    }
  }

  /**
   * Batch update multiple ranges atomically
   */
  async batchUpdate(data: SheetData[]): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: data.map(item => ({
            range: item.range,
            values: item.values,
          })),
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to batch update sheets: ${error.message}`);
    }
  }

  /**
   * Get sheet metadata (useful for checking if sheets exist)
   */
  async getSheetMetadata() {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get sheet metadata: ${error.message}`);
    }
  }

  /**
   * Create a new sheet (tab) in the spreadsheet
   */
  async createSheet(title: string): Promise<number> {
    try {
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title,
                },
              },
            },
          ],
        },
      });

      const sheetId = response.data.replies[0].addSheet.properties.sheetId;
      return sheetId;
    } catch (error: any) {
      throw new Error(`Failed to create sheet ${title}: ${error.message}`);
    }
  }

  /**
   * Check if a sheet (tab) exists by name
   */
  async sheetExists(title: string): Promise<boolean> {
    try {
      const metadata = await this.getSheetMetadata();
      const sheet = metadata.sheets?.find(
        (s: any) => s.properties.title === title
      );
      return !!sheet;
    } catch {
      return false;
    }
  }

  /**
   * Get the spreadsheet ID (useful for logging)
   */
  getSpreadsheetId(): string {
    return this.spreadsheetId;
  }

  /**
   * Get the full spreadsheet URL
   */
  getSpreadsheetUrl(): string {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
  }
}

// Export a singleton instance
let sheetsClient: SheetsClient | null = null;

export function getSheetsClient(): SheetsClient {
  if (!sheetsClient) {
    sheetsClient = new SheetsClient();
  }
  return sheetsClient;
}
