"use client";
import { Landmark, Mail, Send, Paintbrush } from 'lucide-react';
import React, { useState } from 'react';

const ContactUs = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className='flex justify-center items-center my-8 relative'>
      <div className='flex flex-row gap-8 flex-wrap justify-center max-w-5xl w-full'>
        {/* Form Card */}
        <div className='text-white w-full max-w-[480px] bg-[#0d1527] border border-[#16243f] rounded-3xl p-6 sm:p-8 card-spray-shadow font-body'>
          <div className='flex items-center gap-2 mb-2'>
            <span className='font-tag text-xs uppercase tracking-wider text-[#38bdf8] bg-[#0ea5e9]/15 px-2.5 py-0.5 rounded-full border border-[#0ea5e9]/30'>
              ✦ STREET DISPATCH ✦
            </span>
          </div>
          <h3 className='text-2xl font-extrabold text-white'>
            Talk to <span className='font-tag text-[#38bdf8]'>AssistIQ</span>
          </h3>
          <p className='text-gray-400 text-xs mt-1 leading-relaxed'>
            Questions, integration requests, or feature inquiries? Drop a message directly to the team.
          </p>

          <form onSubmit={handleSubmit} className='mt-6 space-y-4'>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='text-[11px] text-gray-300 font-semibold uppercase tracking-wider block mb-1'>First Name</label>
                <input
                  required
                  className="w-full bg-black/50 border border-[#16243f] focus:border-[#38bdf8] outline-none rounded-xl p-2.5 text-xs text-white transition-colors"
                  type='text'
                  placeholder='First name'
                />
              </div>
              <div>
                <label className='text-[11px] text-gray-300 font-semibold uppercase tracking-wider block mb-1'>Last Name</label>
                <input
                  required
                  className="w-full bg-black/50 border border-[#16243f] focus:border-[#38bdf8] outline-none rounded-xl p-2.5 text-xs text-white transition-colors"
                  type='text'
                  placeholder='Last name'
                />
              </div>
            </div>

            <div>
              <label className='text-[11px] text-gray-300 font-semibold uppercase tracking-wider block mb-1'>Email Address</label>
              <input
                required
                className="w-full bg-black/50 border border-[#16243f] focus:border-[#38bdf8] outline-none rounded-xl p-2.5 text-xs text-white transition-colors"
                type="email"
                placeholder='you@domain.com'
              />
            </div>

            <div>
              <label className='text-[11px] text-gray-300 font-semibold uppercase tracking-wider block mb-1'>Message</label>
              <textarea
                required
                rows={4}
                className="w-full bg-black/50 border border-[#16243f] focus:border-[#38bdf8] outline-none rounded-xl p-2.5 text-xs text-white transition-colors resize-none"
                placeholder='What can we help you build or study?'
              />
            </div>

            <button
              type='submit'
              className='w-full bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2 cursor-pointer font-tag'
            >
              <Send className='w-4 h-4' />
              <span>{submitted ? "MESSAGE SPRAYED!" : "SEND DISPATCH"}</span>
            </button>
          </form>
        </div>

        {/* Info Card */}
        <div className='flex flex-col justify-between w-full max-w-[380px] p-6 sm:p-8 bg-[#0d1527] border border-[#16243f] rounded-3xl card-spray-shadow font-body'>
          <div>
            <div className='w-12 h-12 rounded-xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 flex items-center justify-center mb-4 text-[#38bdf8]'>
              <Paintbrush className='w-6 h-6' />
            </div>
            <h4 className='text-xl font-bold text-white'>AssistIQ</h4>
            <p className='text-gray-400 text-xs mt-2 leading-relaxed'>
              Autonomous academic tools crafted for college students and researchers who need raw speed and clean focus.
            </p>

            <div className='mt-8 space-y-4 text-xs'>
              <div className='flex items-center gap-3 text-gray-300'>
                <div className='w-8 h-8 rounded-lg bg-black/50 border border-[#16243f] flex items-center justify-center text-[#38bdf8]'>
                  <Mail className='w-4 h-4' />
                </div>
                <span>team@assistiq.ai</span>
              </div>
              <div className='flex items-center gap-3 text-gray-300'>
                <div className='w-8 h-8 rounded-lg bg-black/50 border border-[#16243f] flex items-center justify-center text-[#38bdf8]'>
                  <Landmark className='w-4 h-4' />
                </div>
                <span>AssistIQ Lab // Street Division</span>
              </div>
            </div>
          </div>

          <div className='mt-8 pt-4 border-t border-[#16243f] text-[11px] text-gray-500 font-tag tracking-wider'>
            ✦ NO SPAM ✦ INSTANT DISPATCH ✦
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
