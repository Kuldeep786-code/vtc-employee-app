import { createClient } from '@supabase/supabase-js'

// DIRECT CREDENTIALS - YAHIN PASTE KAREIN
const supabaseUrl = 'https://fhgvqvrjeqrvcmdlnqog.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZ3ZxdnJqZXFydmNtZGxucW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MTk5MTQsImV4cCI6MjA3Mzk5NTkxNH0.qhky2garnqLS1-wFZ_f09cwSvg9PKvWhdIuzoAtC6yM'

// NAMED EXPORT USE KAREIN (export const)
export const supabase = createClient(supabaseUrl, supabaseKey)